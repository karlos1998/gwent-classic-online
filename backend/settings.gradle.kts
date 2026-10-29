plugins {
    // downloads a matching JDK automatically when Java 21 is not installed locally
    id("org.gradle.toolchains.foojay-resolver-convention") version "0.10.0"
}

rootProject.name = "gwent-online-server"
