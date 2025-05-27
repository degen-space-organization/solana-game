#!/bin/bash

# Navigate to the migrations folder
MIGRATIONS_DIR="./supabase/migrations"
OUTPUT_FILE="./all-migrations.sql"

# Clear or create the output file
> "$OUTPUT_FILE"

# Concatenate all .sql files in order
for file in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
  echo "-- File: $(basename "$file")" >> "$OUTPUT_FILE"
  cat "$file" >> "$OUTPUT_FILE"
  echo -e "\n\n" >> "$OUTPUT_FILE"
done

echo "✅ Combined all migrations into $OUTPUT_FILE"