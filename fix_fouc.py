import os
import re
import glob

def clean_dashboard_dummy_data():
    files = glob.glob("dashboard/admin/*.html")
    
    for filepath in files:
        with open(filepath, 'r') as f:
            content = f.read()
            
        new_content = content
        # Clear out any dummy rows inside tbody
        new_content = re.sub(r'<tbody[^>]*>.*?</tbody>', lambda m: m.group(0).split('>')[0] + '></tbody>', new_content, flags=re.DOTALL)
        
        # Specific stats in clusterdashboard.html
        if 'clusterdashboard.html' in filepath:
            new_content = new_content.replace(">48<", ">0<")
            new_content = new_content.replace(">124<", ">0<")
            new_content = new_content.replace(">1,208<", ">0<")
            new_content = new_content.replace(">16<", ">0<")
            
        if content != new_content:
            with open(filepath, 'w') as f:
                f.write(new_content)
            print(f"Cleaned dummy data in {filepath}")

if __name__ == "__main__":
    clean_dashboard_dummy_data()
