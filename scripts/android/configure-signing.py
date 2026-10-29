#!/usr/bin/env python3
"""Wires release signing into the generated Android project (src-tauri/gen/android).

Reads the keystore from the environment (never from the repository), writes a runner-only keystore.properties, and patches the generated
app/build.gradle.kts once: a signingConfigs { release } block, and `signingConfig = ...` inside the release build type.

  ANDROID_KEY_BASE64    the .jks keystore, base64 encoded     (GitHub secret)
  ANDROID_KEY_PASSWORD  the keystore (and key) password       (GitHub secret)
  ANDROID_KEY_ALIAS     the key alias                         (GitHub secret)
  RUNNER_TEMP           where the decoded keystore is written
"""
import base64, os, re, subprocess, sys
from pathlib import Path

def need(name):
    v = os.environ.get(name, "")
    if not v:
        sys.exit(f"::error::Missing {name}. Add it under Settings → Secrets and variables → Actions.")
    return v

key_b64, password, alias = need("ANDROID_KEY_BASE64"), need("ANDROID_KEY_PASSWORD"), need("ANDROID_KEY_ALIAS")
android = Path("src-tauri/gen/android")
gradle = android / "app" / "build.gradle.kts"
if not gradle.exists():
    sys.exit(f"::error::{gradle} was not generated; run `npx tauri android init` first.")

keystore = Path(os.environ.get("RUNNER_TEMP", "/tmp")) / "opentick-release.jks"
keystore.write_bytes(base64.b64decode(key_b64))
keystore.chmod(0o600)

# check the keystore and alias before touching Gradle: a wrong secret fails here, in seconds, not after a 10 minute build
subprocess.run(["keytool", "-list", "-keystore", str(keystore), "-storepass", password, "-alias", alias],
               check=True, stdout=subprocess.DEVNULL)

props = android / "keystore.properties"
props.write_text(f"storePassword={password}\nkeyPassword={password}\nkeyAlias={alias}\nstoreFile={keystore}\n")
props.chmod(0o600)

text = gradle.read_text(encoding="utf-8")
for imp in ("import java.io.FileInputStream", "import java.util.Properties"):
    if imp not in text:
        text = imp + "\n" + text

if 'create("release")' not in text:
    m = re.search(r'(?m)^(\s*)buildTypes\s*\{', text)
    if not m:
        sys.exit("Could not find the Gradle buildTypes block; refusing to modify the generated file.")
    i = m.group(1)
    block = (f'{i}signingConfigs {{\n{i}    create("release") {{\n'
             f'{i}        val propsFile = rootProject.file("keystore.properties")\n'
             f'{i}        val props = Properties()\n{i}        props.load(FileInputStream(propsFile))\n'
             f'{i}        storeFile = file(props["storeFile"] as String)\n'
             f'{i}        storePassword = props["storePassword"] as String\n'
             f'{i}        keyAlias = props["keyAlias"] as String\n'
             f'{i}        keyPassword = props["keyPassword"] as String\n'
             f'{i}    }}\n{i}}}\n\n')
    text = text[:m.start()] + block + text[m.start():]

m = re.search(r'(?m)^(\s*)getByName\("release"\)\s*\{', text)
if not m:
    sys.exit('Could not find getByName("release") in build.gradle.kts; refusing to guess where signing goes.')
start, depth, i = m.end(), 1, m.end()
while i < len(text) and depth:
    depth += {"{": 1, "}": -1}.get(text[i], 0)
    i += 1
if depth:
    sys.exit("Could not locate the end of the release block.")
if "signingConfig = signingConfigs.getByName" not in text[m.start():i]:
    text = text[:start] + "\n" + m.group(1) + '    signingConfig = signingConfigs.getByName("release")' + text[start:]

gradle.write_text(text, encoding="utf-8")
print("Configured Android release signing.")
