const express = require('express');
const cors = require('cors');
const db = require('./database');
const utils = require('./personUtils');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve uploaded images
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

/**
 * Remove circular references from person objects for safe JSON serialization
 */
function removeCircularReferences(person, visited = new Set()) {
    if (!person || typeof person !== 'object' || visited.has(person)) return;

    visited.add(person);

    if (person.parent) {
        delete person.parent;
    }
    if (person.partner) {
        if (person.partner.parent) {
            delete person.partner.parent;
        }
        if (!visited.has(person.partner)) {
            removeCircularReferences(person.partner, visited);
        }
    }

    if (person.children && Array.isArray(person.children)) {
        person.children.forEach(child => removeCircularReferences(child, visited));
    }
}

/**
 * Save base64 image to file and return filename
 */
function saveImageFromBase64(imageData, filename) {
    try {
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const filepath = path.join(uploadsDir, filename);
        fs.writeFileSync(filepath, buffer);
        return `/uploads/${filename}`;
    } catch (error) {
        console.error('Error saving image:', error.message);
        return null;
    }
}


app.get('/api/family', (req, res) => {
    const getPersons = 'SELECT * FROM Person';
    const getRelationships = 'SELECT * FROM Relationship';

    db.all(getPersons, [], (err, persons) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch persons' });
        }

        db.all(getRelationships, [], (err2, relationships) => {
            if (err2) {
                return res.status(500).json({ error: 'Failed to fetch relationships' });
            }

            // Return only flat arrays, sorted by id
            const sortedPersons = persons.sort((a, b) => a.id - b.id);
            const sortedRelationships = relationships.sort((a, b) => a.id - b.id);

            res.json({
                persons: sortedPersons,
                relationships: sortedRelationships
            });
        });
    });
});


    app.get('/api/persons', (req, res) => {
        db.all('SELECT * FROM Person ORDER BY birthDate ASC', [], (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        });
    });

    app.get('/api/persons_with_relationships', (req, res) => {
        const query = `
        SELECT
            p.*,
            r.type AS relationship,
            r.personId1 AS parentId,
            r.personId2 AS childId
        FROM Person p
        LEFT JOIN Relationship r ON p.id = r.personId2`;

        db.all(query, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });

    app.get('/api/relationships', (req, res) => {
        db.all('SELECT * FROM Relationship', [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });

    app.post('/api/family', (req, res) => {
        let { name, birthDate, deathDate, image, parentId, partner_Id, gender } = req.body;
        deathDate = deathDate || null;

        // Validate required fields
        if (!name || !birthDate || !gender) {
            console.error('Bad request:', req.body);
            return res.status(400).json({ error: 'Missing required fields: name, birthDate, or gender' });
        }

        // Validate gender
        if (!utils.validateGender(gender)) {
            return res.status(400).json({ error: 'Invalid gender. Must be: male, female, nonbinary, or other' });
        }

        // Validate dates
        const dateValidation = utils.validateDates(birthDate, deathDate);
        if (!dateValidation.valid) {
            return res.status(400).json({ error: 'Invalid dates', details: dateValidation.errors });
        }

        // Validate image URL if provided
        if (image && !utils.validateImageUrl(image)) {
            return res.status(400).json({ error: 'Invalid image URL format' });
        }

        console.log('Received request body:', req.body);

        const insertPersonQuery = `INSERT INTO Person (name, birthDate, deathDate, image, gender) VALUES (?, ?, ?, ?, ?)`;

        db.run(insertPersonQuery, [name, birthDate, deathDate, image, gender], function (err) {
            if (err) {
                console.error('Error inserting person:', err.message);
                return res.status(500).json({ error: 'Failed to insert person' });
            }

            const newPersonId = this.lastID;
            console.log(`Inserted new person with ID ${newPersonId}`);

            const insertRelationships = [];

            if (parentId) {
                insertRelationships.push({
                    personId1: parentId,
                    personId2: newPersonId,
                    type: 'parent'
                })
            }
            if (partner_Id) {
                insertRelationships.push({
                    personId1: newPersonId,
                    personId2: partner_Id,
                    type: 'spouse'
                },
                    {
                        personId1: partner_Id,
                        personId2: newPersonId,
                        type: 'spouse'
                    });
            }

            const insertNextRelationship = () => {
                if (insertRelationships.length === 0) return sendNewPerson();

                const { personId1, personId2, type } = insertRelationships.shift();
                const insertRelationshipQuery = `INSERT INTO Relationship (personId1, personId2, type) VALUES (?, ?, ?)`;

                db.run(insertRelationshipQuery, [personId1, personId2, type], function (relErr) {
                    if (relErr) {
                        console.error("Error creating relationship:", relErr.message);
                        return res.status(500).json({ error: 'Failed to insert relationship' });
                    }
                    console.log(`Created relationship: ${type} ${personId1} -> ${personId2}`);
                    insertNextRelationship();
                });
            };

            const sendNewPerson = () => {
                db.get('SELECT * FROM Person WHERE id = ?', [newPersonId], (selectErr, row) => {
                    if (selectErr) {
                        return res.status(500).json({ error: 'Failed to fetch inserted person' });
                    }
                    res.status(201).json(utils.formatPersonCard(row));
                });
            };

            if (insertRelationships.length > 0) {
                insertNextRelationship();
            } else {
                sendNewPerson();
            }

        });
    });

    app.patch('/api/person/:id/gender', (req, res) => {
        const { id } = req.params;
        const { gender } = req.body;

        if (!gender) {
            return res.status(400).json({ error: 'Missing gender field' });
        }

        if (!utils.validateGender(gender)) {
            return res.status(400).json({ error: 'Invalid gender value' });
        }

        const query = 'UPDATE Person SET gender = ? WHERE id = ?';

        db.run(query, [gender, id], function (err) {
            if (err) {
                console.error('Error updating gender:', err.message);
                return res.status(500).json({ error: 'Failed to update gender' });
            }
            res.status(200).json({ message: 'Gender updated successfully' });
        });
    });

    // Get detailed person profile with all relationships
    app.get('/api/person/:id/profile', (req, res) => {
        const { id } = req.params;

        db.get('SELECT * FROM Person WHERE id = ?', [id], (err, person) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch person' });
            }
            if (!person) {
                return res.status(404).json({ error: 'Person not found' });
            }

            db.all('SELECT * FROM Relationship WHERE personId1 = ? OR personId2 = ?', [id, id], (relErr, relationships) => {
                if (relErr) {
                    return res.status(500).json({ error: 'Failed to fetch relationships' });
                }

                const profileData = {
                    ...utils.formatPersonCard(person, relationships || []),
                    relationships: relationships || [],
                    formattedBirthDate: utils.formatDate(person.birthDate),
                    formattedDeathDate: utils.formatDate(person.deathDate)
                };

                res.json(profileData);
            });
        });
    });

    // Search persons by name
    app.get('/api/persons/search/:query', (req, res) => {
        const searchTerm = `%${req.params.query}%`;
        
        db.all('SELECT * FROM Person WHERE name LIKE ? ORDER BY name ASC', [searchTerm], (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Search failed' });
            }

            const results = rows.map(person => utils.formatPersonCard(person));
            res.json(results);
        });
    });

    // Get family tree statistics
    app.get('/api/stats', (req, res) => {
        const personCount = 'SELECT COUNT(*) as count FROM Person';
        const relationshipCount = 'SELECT COUNT(*) as count FROM Relationship';
        const avgAge = `SELECT AVG(CAST((julianday('now') - julianday(birthDate)) / 365.25 AS INTEGER)) as avgAge 
                        FROM Person WHERE deathDate IS NULL`;

        db.get(personCount, (err1, persons) => {
            db.get(relationshipCount, (err2, relationships) => {
                db.get(avgAge, (err3, age) => {
                    if (err1 || err2 || err3) {
                        return res.status(500).json({ error: 'Failed to fetch stats' });
                    }

                    res.json({
                        totalPersons: persons.count,
                        totalRelationships: relationships.count,
                        averageAge: Math.round(age.avgAge) || 0
                    });
                });
            });
        });
    });

    // Upload image (base64)
    app.post('/api/upload-image', (req, res) => {
        const { image, filename } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'No image provided' });
        }

        // Validate base64 format
        if (!image.startsWith('data:image/')) {
            return res.status(400).json({ error: 'Invalid image format. Must be base64 encoded image' });
        }

        const fileExt = image.split(';')[0].split('/')[1] || 'png';
        const safeFilename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const imagePath = saveImageFromBase64(image, safeFilename);

        if (!imagePath) {
            return res.status(500).json({ error: 'Failed to save image' });
        }

        res.status(201).json({ imagePath, filename: safeFilename });
    });

    // Update person info
    app.patch('/api/person/:id', (req, res) => {
        const { id } = req.params;
        const { name, birthDate, deathDate, image, gender } = req.body;

        // Validate inputs if provided
        if (gender && !utils.validateGender(gender)) {
            return res.status(400).json({ error: 'Invalid gender value' });
        }

        if ((birthDate || deathDate) && !utils.validateDates(birthDate || '', deathDate).valid) {
            return res.status(400).json({ error: 'Invalid date values' });
        }

        if (image && !utils.validateImageUrl(image)) {
            return res.status(400).json({ error: 'Invalid image URL' });
        }

        // Build dynamic update query
        const updates = [];
        const values = [];

        if (name) { updates.push('name = ?'); values.push(name); }
        if (birthDate) { updates.push('birthDate = ?'); values.push(birthDate); }
        if (deathDate !== undefined) { updates.push('deathDate = ?'); values.push(deathDate); }
        if (image) { updates.push('image = ?'); values.push(image); }
        if (gender) { updates.push('gender = ?'); values.push(gender); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(id);

        const query = `UPDATE Person SET ${updates.join(', ')} WHERE id = ?`;

        db.run(query, values, function (err) {
            if (err) {
                console.error('Error updating person:', err.message);
                return res.status(500).json({ error: 'Failed to update person' });
            }

            db.get('SELECT * FROM Person WHERE id = ?', [id], (selectErr, person) => {
                if (selectErr) {
                    return res.status(500).json({ error: 'Failed to fetch updated person' });
                }
                res.json(utils.formatPersonCard(person));
            });
        });
    });

    // Get descendants count for a person
    app.get('/api/person/:id/descendants', (req, res) => {
        const { id } = req.params;

        db.all(`
            WITH RECURSIVE descendants AS (
                SELECT id, parentId FROM Person WHERE id = ?
                UNION ALL
                SELECT p.id, p.parentId FROM Person p
                JOIN descendants d ON p.parentId = d.id
            )
            SELECT COUNT(*) as count FROM descendants WHERE id != ?
        `, [id, id], (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch descendants' });
            }
            res.json({ personId: id, descendantCount: rows[0].count });
        });
    });

    // Get ancestors for a person
    app.get('/api/person/:id/ancestors', (req, res) => {
        const { id } = req.params;

        db.all(`
            WITH RECURSIVE ancestors AS (
                SELECT * FROM Person WHERE id = ?
                UNION ALL
                SELECT p.* FROM Person p
                JOIN ancestors a ON a.parentId = p.id
            )
            SELECT * FROM ancestors
        `, [id], (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch ancestors' });
            }
            const ancestors = rows.map(person => utils.formatPersonCard(person));
            res.json(ancestors);
        });
    });

    app.delete('/api/family/:id', (req, res) => {
        const { id } = req.params;

        db.run('DELETE FROM Relationship WHERE personId1 = ? OR personId2 = ?', [id, id], function (err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to delete relationships' });
            }

            db.run('DELETE FROM Person WHERE id = ?', [id], function (err2) {
                if (err2) {
                    return res.status(500).json({ error: 'Failed to delete person' });
                }

                res.status(200).json({ message: 'Person deleted successfully' });
            });
        });
    });

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });