from pathlib import Path
import zipfile
root = Path(__file__).resolve().parent
bundle = "\n".join((root/name).read_text() for name in ["react.production.min.js", "react-dom.production.min.js", "sdk.js", "numbering.js", "plugin.js"])
(root/"index-sandbox.js").write_text(bundle)
(root/"index.js").write_text("const IMPORT_META = import.meta;\n" + bundle)
files = ["manifest.json", "index.html", "index.js", "index-sandbox.js", "App.css", "snippet.css", "logo.svg", "numbering.js", "plugin.js", "sdk.js", "react.production.min.js", "react-dom.production.min.js", "README.md", "THIRD-PARTY-LICENSES.txt"]
with zipfile.ZipFile(root/"RemNote-Plugin.zip", "w", zipfile.ZIP_DEFLATED) as package:
    for name in files: package.write(root/name, name)
print(root/"RemNote-Plugin.zip")
