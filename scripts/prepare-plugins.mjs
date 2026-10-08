import fs from 'node:fs'
// Upstream 8.5.12 prints Apple identity payloads and persisted tokens in native logs.
// Remove diagnostic print statements from this provider until upstream fixes it.
// Auth behavior remains provided by the maintained plugin, unchanged.
const path = 'node_modules/@capgo/capacitor-social-login/ios/Sources/SocialLoginPlugin/AppleProvider.swift'
if (fs.existsSync(path)) {
  const source = fs.readFileSync(path, 'utf8')
  fs.writeFileSync(path, source.replace(/^([ \t]*)print\(.*\)\s*$/gm, '$1// Pocket Memory: omit provider diagnostics containing personal data.'))
}
// The upstream SPM configuration hook misses Google entries without a trailing comma.
// Respect our Apple-only configuration for those final array entries as well.
const manifestPath = 'node_modules/@capgo/capacitor-social-login/Package.swift'
if (fs.existsSync(manifestPath)) {
  const config = JSON.parse(fs.readFileSync('capacitor.config.json', 'utf8'))
  if (config.plugins?.SocialLogin?.providers?.google === 'compileOnly') {
    const manifest = fs.readFileSync(manifestPath, 'utf8')
    fs.writeFileSync(manifestPath, manifest.replace(/^(\s*)(\.package\(url: "https:\/\/github.com\/google\/GoogleSignIn-iOS.git"[^\n]*|\.product\(name: "GoogleSignIn"[^\n]*)$/gm, '$1// $2 // Disabled: Apple-only app.'))
  }
}
