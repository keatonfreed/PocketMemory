import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import xcode from 'xcode'
import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })
const projectPath = 'ios/App/App.xcodeproj/project.pbxproj'
const project = xcode.project(projectPath)
project.parseSync()
const bundleId = process.env.APPLE_BUNDLE_ID || 'app.pocketmemory.ios'
if (!/^[a-zA-Z0-9.-]+$/.test(bundleId)) throw new Error('Invalid APPLE_BUNDLE_ID')
project.updateBuildProperty('PRODUCT_BUNDLE_IDENTIFIER', bundleId)
project.updateBuildProperty('MARKETING_VERSION', JSON.parse(fs.readFileSync('package.json', 'utf8')).version)
if (process.env.IOS_BUILD_NUMBER) {
  if (!/^\d+$/.test(process.env.IOS_BUILD_NUMBER)) throw new Error('IOS_BUILD_NUMBER must be a positive integer')
  project.updateBuildProperty('CURRENT_PROJECT_VERSION', process.env.IOS_BUILD_NUMBER)
}
project.updateBuildProperty('CODE_SIGN_ENTITLEMENTS', 'App/App.entitlements')
project.updateBuildProperty('TARGETED_DEVICE_FAMILY', '1')
if (process.env.APPLE_TEAM_ID) project.updateBuildProperty('DEVELOPMENT_TEAM', process.env.APPLE_TEAM_ID)
const group = project.findPBXGroupKey({ name: 'App' }) || project.findPBXGroupKey({ path: 'App' })
if (!project.hasFile('PrivacyInfo.xcprivacy')) {
  const file = project.addFile('PrivacyInfo.xcprivacy', group, { lastKnownFileType: 'text.xml', defaultEncoding: 4 })
  file.uuid = project.generateUuid()
  file.target = project.getFirstTarget().uuid
  project.addToPbxBuildFileSection(file)
  project.addToPbxResourcesBuildPhase(file)
}
for (const file of Object.values(project.pbxFileReferenceSection())) {
  if (typeof file === 'object' && String(file.path).includes('PrivacyInfo.xcprivacy')) {
    file.lastKnownFileType = 'text.xml'
    file.fileEncoding = 4
    delete file.explicitFileType
  }
}
fs.writeFileSync(projectPath, project.writeSync())
fs.writeFileSync('ios/App/App/App.entitlements', `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>com.apple.developer.applesignin</key><array><string>Default</string></array></dict></plist>\n`)
const plistPath = 'ios/App/App/Info.plist'
const info = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', plistPath], { encoding: 'utf8' }))
info.UIUserInterfaceStyle = 'Dark'
info.UIFileSharingEnabled = false
info.LSSupportsOpeningDocumentsInPlace = false
// SQLCipher is linked by the SQLite plugin; review export compliance before distribution.
info.ITSAppUsesNonExemptEncryption = true
fs.writeFileSync(plistPath, JSON.stringify(info))
execFileSync('plutil', ['-convert', 'xml1', plistPath])
console.log('Configured Sign in with Apple, bundle ID, privacy manifest, and iPhone target.')
