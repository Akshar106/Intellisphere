import os
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

BASE_URL = "https://legalaffairs.gov.in/media/e-book"

SAVE_FOLDER = "downloaded_pdfs34"
os.makedirs(SAVE_FOLDER, exist_ok=True)

downloaded_pdfs = set(os.listdir(SAVE_FOLDER))

def download_pdfs(url):
    pdf_count = len(downloaded_pdfs) + 1  #

    while url:
        response = requests.get(url)
        if response.status_code != 200:
            print(f"Failed to access {url}")
            break

        soup = BeautifulSoup(response.text, "html.parser")

        # Extract PDF links
        pdf_links = [
            urljoin(url, a["href"])
            for a in soup.find_all("a", href=True)
            if a["href"].endswith(".pdf")
        ]

        if not pdf_links:
            print("No PDFs found on this page.")
        else:
            print(f"Found {len(pdf_links)} PDFs. Downloading...")

        # Download PDFs with sequential naming, avoiding duplicates
        for pdf_url in pdf_links:
            pdf_filename = pdf_url.split("/")[-1]
            if pdf_filename in downloaded_pdfs:
                print(f"Skipping duplicate: {pdf_filename}")
                continue

            pdf_name = os.path.join(SAVE_FOLDER, f"{pdf_count}.pdf")

            try:
                pdf_data = requests.get(pdf_url, stream=True)
                with open(pdf_name, "wb") as pdf_file:
                    for chunk in pdf_data.iter_content(chunk_size=1024):
                        pdf_file.write(chunk)
                print(f"Downloaded: {pdf_name}")

                # Add to the set to prevent duplicates
                downloaded_pdfs.add(pdf_filename)
                pdf_count += 1
            except Exception as e:
                print(f"Failed to download {pdf_url}: {e}")

        next_page_tag = soup.find("a", string=lambda text: text and "Next »" in text)
        if next_page_tag and "href" in next_page_tag.attrs:
            url = urljoin(url, next_page_tag["href"])
            print(f"Moving to next page: {url}")
        else:
            print("No more pages found.")
            break  

download_pdfs(BASE_URL)
