import os
import glob

def update_references():
    files = glob.glob("**/*.html", recursive=True) + glob.glob("**/*.sql", recursive=True)
    
    replacements = [
        (".JPG.jpeg", ".JPG.webp"),
        (".png", ".webp") # Some large pngs were also converted, but wait, replacing all .png to .webp might break some icons. Let's stick to the specific big ones or just .JPG.jpeg.
    ]
    
    for filepath in files:
        if 'node_modules' in filepath or '.git' in filepath:
            continue
        with open(filepath, 'r') as f:
            content = f.read()
            
        new_content = content
        new_content = new_content.replace(".JPG.jpeg", ".JPG.webp")
        new_content = new_content.replace("ai_future.png", "ai_future.webp")
        new_content = new_content.replace("Village Outreach Program.png", "Village Outreach Program.webp")
        new_content = new_content.replace("Bamboo Workshop.png", "Bamboo Workshop.webp")
        new_content = new_content.replace("NER-Japan Student Interaction Program_14th march 2026.png", "NER-Japan Student Interaction Program_14th march 2026.webp")
        new_content = new_content.replace("Pre-AI at IIT Guwahati.png", "Pre-AI at IIT Guwahati.webp")
        new_content = new_content.replace("Indo-Japan_8th march 2026.png", "Indo-Japan_8th march 2026.webp")
        
        if content != new_content:
            with open(filepath, 'w') as f:
                f.write(new_content)
            print(f"Updated {filepath}")

if __name__ == "__main__":
    update_references()
