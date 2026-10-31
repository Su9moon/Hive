"""Offline source/asset checks only. Does not execute PowerShell or Chrome."""
import base64
import hashlib
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = (ROOT / 'scripts/chrome-dev-same-id-rehearsal.ps1').read_text()


class OfflineChecks(unittest.TestCase):
    def test_public_key_identity(self):
        key = json.loads((ROOT / 'manifest.json').read_text())['key']
        digest = hashlib.sha256(base64.b64decode(key, validate=True)).digest()[:16]
        extension_id = ''.join(chr(97 + int(n, 16)) for n in digest.hex())
        self.assertEqual(extension_id, 'kheifdlffdfcgmapmbbahdgkpccckmbn')
        self.assertIn(extension_id, SCRIPT)

    def test_minimal_mock_source(self):
        self.assertIn("permissions=@('storage')", SCRIPT)
        self.assertIn("foreach ($label in @('A', 'B'))", SCRIPT)
        self.assertIn("service_worker='worker.js'", SCRIPT)
        for forbidden in ('nativeMessaging', 'host_permissions', 'content_scripts',
                          'connectNative', 'sendNativeMessage', 'chrome.tabs'):
            self.assertNotIn(forbidden, SCRIPT)
        worker = re.search(r'\$worker = @"\n(.*?)\n"@', SCRIPT, re.S).group(1)
        self.assertIn("chrome.storage.local.get('rehearsalMarker')", worker)
        self.assertIn('globalThis.writeRehearsal = async value', worker)
        self.assertNotIn('onInstalled', worker)
        self.assertNotIn('fetch(', worker)

    def test_path_and_launch_guards_present(self):
        self.assertNotIn('[string]$UserDataDir', SCRIPT)
        for required in ('[Guid]::NewGuid()', 'ReparsePoint', 'Overlaps $temp $current',
                         'Overlaps $profile $current', "if ($Launch)",
                         "Profile is no longer empty", '--user-data-dir=',
                         'chromeUat=\'NOT_RUN\'', "readiness='BLOCKED'"):
            self.assertIn(required, SCRIPT)
        self.assertEqual(SCRIPT.count('Start-Process '), 1)
        self.assertLess(SCRIPT.index('Profile is no longer empty'), SCRIPT.index('Start-Process '))
        for forbidden in ('Copy-Item', 'Remove-Item', 'Stop-Process', 'reg.exe',
                          'HKCU:', 'sqlite', 'C:\\Users\\', 'F:\\', '--profile-directory',
                          'Invoke-Expression', 'Invoke-WebRequest'):
            self.assertNotIn(forbidden, SCRIPT)


if __name__ == '__main__':
    unittest.main(verbosity=2)
