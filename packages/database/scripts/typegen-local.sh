#!/bin/bash

# This script is used to automatically generate typescript types
# into a file at the destination, both of which are specified in this script
#
# The script will generate the types from the local database instance, so no
# auth is required.
#
# It is to be ran every time the database schema is updated


# Define the path and the file name for generated types
# 
# IMPORTANT! the path is relative to the project root
# IMPORTANT! the names dont start or end with /
TYPES_DIR="packages/server/src/database"
TYPES_FILE_NAME="types.ts"


# Find the project root directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
PROJECT_ROOT="$( cd "$DIR/../../.." && pwd )"



# Path to the types file
TYPES_PATH="$PROJECT_ROOT/$TYPES_DIR/$TYPES_FILE_NAME"

# Generate types
npx supabase gen types typescript --local > "$TYPES_PATH"

# Alert the console
echo "Supabase types generated at $TYPES_PATH"