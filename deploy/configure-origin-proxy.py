#!/usr/bin/env python3
"""Run on the production host to restrict only the Gwent vhost to Cloudflare.

Requires access to the existing nginx-proxy container. Fetches official IP ranges,
normalizes forwarded client headers and validates nginx before reloading it.
"""
import ipaddress
import json
import subprocess
import urllib.request
from datetime import datetime, timezone

CONTAINER = 'nginx-proxy-nginx-proxy-1'
HOST = 'gwent.letscode.it'
DIRECTORY = '/etc/nginx/vhost.d/'


def docker(*args, data=None):
    return subprocess.run(['docker', 'exec', '-i', CONTAINER, *args], input=data,
                          text=True, check=True, capture_output=True).stdout


def write_file(path, content):
    # nginx mounts vhost.d read-only. Use the already running image as a short-lived,
    # isolated writer, mounting only this directory, without a socket or network.
    image = subprocess.run(['docker', 'inspect', '--format', '{{.Image}}', CONTAINER],
                           text=True, capture_output=True, check=True).stdout.strip()
    command = 'rm -f "/vhost/$1"' if content is None else 'cat > "/vhost/$1"'
    subprocess.run(['docker', 'run', '--rm', '-i', '--pull=never', '--network=none',
                    '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges',
                    '--user=0', '-v', '/opt/apps/nginx-proxy/vhost:/vhost:rw',
                    '--entrypoint=/bin/sh', image, '-c', command, 'sh', path.rsplit('/', 1)[1]],
                   input=content, text=True, check=True, capture_output=True)


def ranges():
    # The public API is accessible from datacenter origins where www.cloudflare.com
    # may return a browser challenge. No account token is needed for this endpoint.
    with urllib.request.urlopen('https://api.cloudflare.com/client/v4/ips', timeout=20) as response:
        data = json.load(response)
    if data.get('success') is not True:
        raise RuntimeError('Cloudflare IP API failed; leaving configuration unchanged')
    networks = []
    for version in (4, 6):
        entries = [ipaddress.ip_network(value) for value in data['result'][f'ipv{version}_cidrs']]
        if len(entries) < (10 if version == 4 else 5) or any(n.version != version or n.prefixlen == 0 for n in entries):
            raise RuntimeError('Unexpected Cloudflare range list; leaving configuration unchanged')
        networks.extend(entries)
    return networks


def main():
    networks = ranges()
    # Access checks use the actual TCP peer, before any header-based rewriting.
    existing_config = docker('nginx', '-T')
    if 'real_ip_header ' in existing_config or 'set_real_ip_from ' in existing_config:
        raise RuntimeError('Existing real-IP rewriting requires review before using this access list')
    generated = '# Managed for Gwent only. Refresh with configure-origin-proxy.py.\n'
    access = generated + 'allow 127.0.0.1;\nallow ::1;\n'
    access += ''.join(f'allow {network};\n' for network in networks) + 'deny all;\n'
    # A location-level proxy_set_header replaces inherited headers: repeat the
    # complete header set, including WebSocket upgrades and httpoxy mitigation.
    headers = generated + '''proxy_set_header Host $host$host_port;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $proxy_connection;
proxy_set_header X-Real-IP $http_cf_connecting_ip;
proxy_set_header X-Forwarded-For $http_cf_connecting_ip;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Ssl $proxy_x_forwarded_ssl;
proxy_set_header X-Forwarded-Port $server_port;
proxy_set_header X-Original-URI $request_uri;
proxy_set_header Proxy "";
'''
    new_files = {DIRECTORY + HOST: access, DIRECTORY + HOST + '_location': headers}
    previous = {}
    for path in new_files:
        found = subprocess.run(['docker', 'exec', CONTAINER, 'cat', path], text=True, capture_output=True)
        if found.returncode == 0:
            previous[path] = found.stdout
            if not found.stdout.startswith(generated):
                raise RuntimeError(f'{path} already has custom configuration; refusing overwrite')
        else:
            previous[path] = None
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    for path, content in previous.items():
        if content is not None:
            write_file(path + '.backup-' + stamp, content)

    def generate():
        docker('docker-gen', '-only-exposed', '/app/nginx.tmpl', '/etc/nginx/conf.d/default.conf')
        docker('nginx', '-t')

    try:
        for path, content in new_files.items():
            write_file(path, content)
        generate()
    except Exception:
        for path, content in previous.items():
            if content is None:
                write_file(path, None)
            else:
                write_file(path, content)
        generate()
        raise
    docker('nginx', '-s', 'reload')
    print(f'Gwent origin restricted to {len(networks)} Cloudflare networks and loopback; forwarded headers normalized')


if __name__ == '__main__':
    main()
