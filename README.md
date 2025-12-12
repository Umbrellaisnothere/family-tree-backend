# Setup & Installation Guide

## Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

## Installation

### 1. Install Dependencies
```bash
npm install
```

This will install:
- `express` - Web framework
- `cors` - Cross-Origin Resource Sharing
- `sqlite3` - Database

### 2. Run the Server
```bash
node server.js
```

You should see:
```
Successfully connected to the database.
Foreign keys enabled.
Person table created or already exists.
Relationship table created or already exists.
Server is running on http://localhost:5000
```

---

## Project Structure

```
family-tree-backend/
├── server.js                  # Main Express server with all API endpoints
├── database.js                # SQLite database initialization & setup
├── personUtils.js             # Utility functions for data formatting & validation
├── addPerson.js               # Example: How to add persons programmatically
├── addRelationship.js         # Example: How to add relationships programmatically
├── getFamilyTree.js           # Example: How to query family tree
├── package.json               # Node.js dependencies
├── family_tree.db             # SQLite database file (auto-created)
├── uploads/                   # Directory for uploaded images (auto-created)
├── API_DOCUMENTATION.md       # Complete API reference
├── IMPROVEMENTS.md            # Summary of all improvements
└── README.md                  # This file
```

---

## Database

### Tables

**Person**
```sql
CREATE TABLE Person (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    birthDate TEXT NOT NULL,
    deathDate TEXT,
    image TEXT,
    gender TEXT CHECK(gender IN ('male', 'female', 'nonbinary', 'other')) NOT NULL,
    parentId INTEGER,
    FOREIGN KEY(parentId) REFERENCES Person(id) ON DELETE SET NULL
)
```

**Relationship**
```sql
CREATE TABLE Relationship (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    personId1 INTEGER NOT NULL,
    personId2 INTEGER NOT NULL,
    type TEXT CHECK(type IN ('parent', 'spouse', 'sibling')) NOT NULL,
    FOREIGN KEY(personId1) REFERENCES Person(id) ON DELETE CASCADE,
    FOREIGN KEY(personId2) REFERENCES Person(id) ON DELETE CASCADE
)
```

---

## API Base URL
```
http://localhost:5000/api
```

---

## Key Features

### ✨ New in This Update

1. **Image Upload**
   - Endpoint: `POST /api/upload-image`
   - Upload base64 encoded images
   - Auto-stored in `/uploads` directory
   - Support for JPG, PNG, GIF, WebP, SVG

2. **Person Card Data**
   - Auto-calculated age
   - Status (living/deceased)
   - Avatar initials
   - Relationship counts
   - Formatted dates

3. **Advanced Queries**
   - Search persons by name
   - Get ancestors (recursive)
   - Count descendants
   - Family statistics

4. **Enhanced Validation**
   - Date logic validation
   - Gender enum validation
   - Image format validation
   - Input sanitization

---

## Common Tasks

### Add a New Person
```bash
curl -X POST http://localhost:5000/api/family \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "birthDate": "1958-11-15",
    "gender": "male",
    "image": "https://picsum.photos/80"
  }'
```

### Upload an Image
```bash
curl -X POST http://localhost:5000/api/upload-image \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/png;base64,iVBORw0KGgoAAAANS..."
  }'
```

### Get Person Profile
```bash
curl http://localhost:5000/api/person/1/profile
```

### Search Persons
```bash
curl http://localhost:5000/api/persons/search/john
```

### Get Statistics
```bash
curl http://localhost:5000/api/stats
```

---

## Environment Variables

Optional - set in terminal before running:
```bash
PORT=5000                # Server port (default: 5000)
```

Example:
```bash
PORT=3000 node server.js
```

---

## Troubleshooting

### "Cannot find module 'express'"
```bash
npm install
```

### "Error opening database"
- Check file permissions
- Ensure write access to project directory

### "Address already in use"
- Change PORT: `PORT=3000 node server.js`
- Or kill existing process using port 5000

### Images not uploading
- Check `/uploads` directory exists
- Ensure directory is writable
- Check file size is under 10MB

---

## Testing the API

### Using the provided example files

**Test addPerson.js (adds sample data)**
```bash
node addPerson.js
```

**Test getFamilyTree.js (queries relationships)**
```bash
node getFamilyTree.js
```

### Using curl

**List all persons**
```bash
curl http://localhost:5000/api/persons
```

**Get person details**
```bash
curl http://localhost:5000/api/person/1/profile
```

**Get family tree for a person**
```bash
curl http://localhost:5000/api/family?search=1
```

---

## Frontend Integration

See `API_DOCUMENTATION.md` for complete endpoint reference and JavaScript examples.

---

## Production Checklist

- [ ] Add CORS whitelist (don't use `*`)
- [ ] Add request rate limiting
- [ ] Add request logging middleware
- [ ] Use environment variables for sensitive data
- [ ] Add database backup strategy
- [ ] Implement authentication
- [ ] Add input rate limits for image uploads
- [ ] Set up error logging service
- [ ] Add database migrations system

---

## Support

For API questions, see: `API_DOCUMENTATION.md`
For improvement details, see: `IMPROVEMENTS.md`
------