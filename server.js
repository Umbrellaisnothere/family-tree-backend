const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
app.use(cors());
app.use(express.json());


app.get('/api/family', (req, res) => {
    const getPersons = 'SELECT * FROM Person';
    const getRelationships = 'SELECT * FROM Relationship';

    db.all(getPersons, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch persons' });
        }

        db.all(getRelationships, [], (err2, relationships) => {
            if (err2) {
                return res.status(500).json({ error: 'Failed to fetch relationships' });
            }

            const personMap = {};
            rows.forEach(p => {
                personMap[p.id] = { ...p, children: [] };
            });

            relationships.forEach(r => {
                if (r.type === 'parent') {
                    const parent = personMap[r.personId1];
                    const child = personMap[r.personId2];
                    if (parent && child) {
                        parent.children.push(child);
                    }
                }
            });

            const childIds = new Set(
                relationships.filter(r => r.type === 'parent').map(r => r.personId2)
            );

            const rootNodes = Object.values(personMap).filter(p => !childIds.has(p.id));

            res.json(rootNodes);
        });
    });
});

app.get('/api/persons', (req, res) => {
    db.all('SELECT * FROM Person', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
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
    let { name, birthDate, deathDate, image, parent_Id, gender } = req.body;
    deathDate = deathDate || null;
    

    if (!name || !birthDate || !gender) {
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

        const sendNewPerson = () => {
            db.get('SELECT * FROM Person WHERE id = ?', [newPersonId], (selectErr, row) => {
                if (selectErr) {
                    return res.status(500).json({ error: 'Failed to fetch inserted person' });
                }
                res.status(201).json(row);
            });
        };

        if (parent_Id) {
            const insertRelationship = `INSERT INTO Relationship (personId1, personId2, type) VALUES (?, ?, ?)`;
            db.run(insertRelationship, [parent_Id, newPersonId, 'parent'], function (relErr) {
                if (relErr) {
                    console.error("Error creating relationship:", relErr.message);
                    return res.status(500).json({ error: 'Failed to insert relationship' });
                }
                console.log(`Creating relationship: parent ${parent_Id} -> child ${newPersonId}`);
                sendNewPerson();
            });
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

    db.run(query, [gender, id], function (err){
        if (err) {
            console.error('Error updating gender:', err.message);
            return res.status(500).json({ error: 'Failed to update gender' });
        }
        res.status(200).json({ message: 'Gender updated successfully'});
    });
});

app.delete('/api/family/:id', (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM Relationship WHERE personId1 = ? OR personId2 = ?', [id, id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete relationships' });
        }

        db.run('DELETE FROM Person WHERE id = ?', [id], function(err2) {
            if (err2) {
                return res.status(500).json({ error: 'Failed to delete person' });
            }

            res.status(200).json({ message: 'Person deleted successfully' });
        });
    });
});

app.listen(5000, () => {
    console.log(`Server is running on http://localhost:5000`);
});