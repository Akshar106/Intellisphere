"""
MongoDB Database Reconstruction Script for Local IntelliSphere
Run this to recreate your database structure after accidental deletion
"""

from pymongo import MongoClient, ASCENDING
import os
from dotenv import load_dotenv

load_dotenv()

# Connect to local MongoDB
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI)

# Select database
db = client["intellisphere6"]

print("🔄 Reconstructing IntelliSphere6 database structure...")
print(f"📍 Connected to: {MONGO_URI}")

# Drop existing collections if they exist (clean slate)
print("\n🧹 Cleaning up any existing collections...")
db.drop_collection("users")
db.drop_collection("chat_histories")
db.drop_collection("sessions")

# 1. Create Users Collection with proper indexes
print("\n📦 Creating 'users' collection...")
users_collection = db["users"]
users_collection.create_index([("email", ASCENDING)], unique=True)
print("   ✅ Created unique index on 'email'")

# 2. Create Chat Histories Collection with compound index
print("\n📦 Creating 'chat_histories' collection...")
chat_history_collection = db["chat_histories"]
chat_history_collection.create_index([
    ("user_email", ASCENDING),
    ("domain", ASCENDING),
    ("session_id", ASCENDING)
], unique=True, name="user_domain_session_idx")
chat_history_collection.create_index([("user_email", ASCENDING)])
chat_history_collection.create_index([("created_at", ASCENDING)])
print("   ✅ Created compound index on 'user_email', 'domain', 'session_id'")
print("   ✅ Created index on 'user_email'")
print("   ✅ Created index on 'created_at'")

# 3. Create Sessions Collection (for Flask-Session)
print("\n📦 Creating 'sessions' collection...")
sessions_collection = db["sessions"]
sessions_collection.create_index([("expireAt", ASCENDING)], expireAfterSeconds=0)
print("   ✅ Created TTL index on 'expireAt'")

# Verify collections were created
collections = db.list_collection_names()
print("\n✅ Database reconstruction complete!")
print(f"📋 Collections created: {', '.join(collections)}")

# Display collection stats
print("\n📊 Collection Statistics:")
for collection_name in collections:
    collection = db[collection_name]
    count = collection.count_documents({})
    indexes = list(collection.list_indexes())
    print(f"\n   {collection_name}:")
    print(f"      Documents: {count}")
    print(f"      Indexes: {len(indexes)}")
    for idx in indexes:
        print(f"         - {idx['name']}")

print("\n" + "="*60)
print("🎉 Your database is ready to use!")
print("⚠️  Note: All user accounts and chat histories have been lost.")
print("📝 Users will need to sign up again.")
print("="*60)

# Close connection
client.close()