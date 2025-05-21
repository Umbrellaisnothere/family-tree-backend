const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

// seen to visited
function removeCircularReferences(person, visited = new Set()) {
    if (!person || typeof person !== 'object' || visited.has(person)) return;

    visited.add(person);

    if (person.partner) {
        delete person.partner.partner;
    }

    if (person.children && Array.isArray(person.children)) {
        person.children.forEach(child => removeCircularReferences(child, visited));
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

            const personMap = {};
            persons.forEach(p => {
                p.children = [];
                p.partner = null;
                p.parent = null;
                personMap[p.id] = p;
            });

            relationships.forEach(r => {
                const p1 = personMap[r.personId1];
                const p2 = personMap[r.personId2];

                if (!p1 || !p2) return;

                if (r.type === 'parent') {
                    p1.children.push(p2);
                    p2.parent = p1;
                }

                if (r.type === 'spouse') {
                    p1.partner = p2;
                    p2.partner = p1;
                }
            });

            const childIds = new Set(
                relationships.filter(r => r.type === 'parent').map(r => r.personId2)
            );

            const rootNodes = Object.values(personMap).filter(p => !childIds.has(p.id));

            rootNodes.forEach(root => removeCircularReferences(root));
            
            res.json({
                roots: rootNodes,
                allPersons: Object.values(personMap)
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


        if (!name || !birthDate || !gender) {
            console.error('Bad request:', req.body);
            return res.status(400).json({ error: 'Missing required fields: name, birthDate, or gender' });
        }

        // Validate 
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
                    res.status(201).json(row);
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

        const query = 'UPDATE Person SET gender = ? WHERE id = ?';

        db.run(query, [gender, id], function (err) {
            if (err) {
                console.error('Error updating gender:', err.message);
                return res.status(500).json({ error: 'Failed to update gender' });
            }
            res.status(200).json({ message: 'Gender updated successfully' });
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