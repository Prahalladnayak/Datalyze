import os
import time
import argparse

def cleanup_datasets(days_threshold=30, dry_run=False):
    # Get backend/data folder path relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.abspath(os.path.join(script_dir, '..', 'data'))
    
    subdirs = ['raw', 'cleaned', 'generated']
    now = time.time()
    cutoff = now - (days_threshold * 86400)
    
    print(f"Starting data cleanup process (Threshold: {days_threshold} days)...")
    if dry_run:
        print("[DRY RUN MODE] No files will actually be deleted.")
        
    total_deleted = 0
    total_bytes_saved = 0
    
    for folder in subdirs:
        target_path = os.path.join(data_dir, folder)
        if not os.path.exists(target_path):
            print(f"Directory not found, skipping: {target_path}")
            continue
            
        print(f"Scanning directory: {target_path}")
        for filename in os.listdir(target_path):
            filepath = os.path.join(target_path, filename)
            
            # Avoid cleaning directories themselves, only files
            if not os.path.isfile(filepath):
                continue
                
            try:
                mtime = os.path.getmtime(filepath)
                if mtime < cutoff:
                    size = os.path.getsize(filepath)
                    last_mod_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(mtime))
                    
                    if not dry_run:
                        os.remove(filepath)
                        print(f"Deleted: {filename} (Last modified: {last_mod_str}, Size: {size} bytes)")
                    else:
                        print(f"[Would Delete]: {filename} (Last modified: {last_mod_str}, Size: {size} bytes)")
                        
                    total_deleted += 1
                    total_bytes_saved += size
            except Exception as e:
                print(f"Error processing {filename}: {e}")
                
    print("\n--- Cleanup Summary ---")
    mb_saved = total_bytes_saved / (1024 * 1024)
    if dry_run:
        print(f"Identified {total_deleted} files to delete. Estimated space saved: {mb_saved:.2f} MB")
    else:
        print(f"Successfully deleted {total_deleted} files. Space saved: {mb_saved:.2f} MB")
    print("-----------------------")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Cleanup orphaned dataset files older than threshold days.")
    parser.add_argument('--days', type=int, default=30, help="Age threshold in days (default: 30)")
    parser.add_argument('--dry-run', action='store_true', help="Scan and list files without deleting them")
    args = parser.parse_args()
    
    cleanup_datasets(days_threshold=args.days, dry_run=args.dry_run)
