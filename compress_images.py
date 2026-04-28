import os
from PIL import Image
import glob

def compress_images(directory):
    # Find all jpeg and png images
    patterns = ["*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG"]
    files = []
    for ext in patterns:
        files.extend(glob.glob(f"{directory}/**/{ext}", recursive=True))

    for file in files:
        size_mb = os.path.getsize(file) / (1024 * 1024)
        if size_mb > 1.0: # Process files larger than 1MB
            try:
                img = Image.open(file)
                # Convert to RGB if necessary
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                
                # Resize if width > 1200
                if img.width > 1200:
                    ratio = 1200.0 / img.width
                    new_height = int(img.height * ratio)
                    img = img.resize((1200, new_height), Image.Resampling.LANCZOS)
                
                # Save as WebP
                new_file = os.path.splitext(file)[0] + ".webp"
                img.save(new_file, "webp", quality=80)
                print(f"Compressed {file} ({size_mb:.2f}MB) -> {new_file}")
            except Exception as e:
                print(f"Failed to compress {file}: {e}")

if __name__ == "__main__":
    compress_images("assets/programpic")
