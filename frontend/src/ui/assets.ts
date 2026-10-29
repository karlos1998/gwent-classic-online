// Image / sound paths (files live in /public, copied 1:1 from the original project)
const BASE = '/'

export const iconPath = (name: string, ext = 'png') => `${BASE}img/icons/${name}.${ext}`
export const largePath = (name: string, ext = 'jpg') => `${BASE}img/lg/${name}.${ext}`
export const smallPath = (name: string, ext = 'jpg') => `${BASE}img/sm/${name}.${ext}`
export const svgPath = (name: string) => `${BASE}svg/${name}.svg`
export const audioPath = (name: string, ext = 'mp3') => (name.includes('.') ? `${BASE}sfx/${name}` : `${BASE}sfx/${name}.${ext}`)

export const iconURL = (name: string, ext = 'png') => `url('${iconPath(name, ext)}')`
export const largeURL = (name: string, ext = 'jpg') => `url('${largePath(name, ext)}')`
export const smallURL = (name: string, ext = 'jpg') => `url('${smallPath(name, ext)}')`
