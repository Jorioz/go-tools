from bs4 import BeautifulSoup
import requests
import re
from datetime import datetime
import json

page = requests.get("https://www.gotransit.com/en/partner-with-us/software-developers")
soup = BeautifulSoup(page.text, "html.parser")

paras = soup.find_all('p', {'data-testid': 'para'})
result = []

for para in paras:
    a_tag = para.find('a', href=True)
    if a_tag and "assets.metrolinx.com/raw/upload/Documents/Metrolinx/Open%20Data/GO-GTFS.zip" in a_tag['href']:
        match = re.search(r'last updated on ([^)]+)\)', a_tag.text)
        last_updated_str = match.group(1) if match else ""
        try:
            last_updated = datetime.strptime(last_updated_str, "%B %d, %Y").date() if last_updated_str else None
        except ValueError:
            last_updated = None
        last_updated_str_out = last_updated.isoformat() if last_updated else None
        result.append({"url": a_tag['href'], "last_updated": last_updated_str_out})

print(json.dumps(result))
