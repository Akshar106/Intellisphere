import os

LAW_PDF_FOLDER = "./data/Law/"

if os.path.exists(LAW_PDF_FOLDER):
    print(f"✅ Folder exists: {LAW_PDF_FOLDER}")
else:
    print(f"❌ Folder does NOT exist: {LAW_PDF_FOLDER}")
