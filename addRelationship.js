const db = require('./database');

function addRelationship(personId1, personId2, type) {
    const query = `INSERT INTO Relationship (personId1, personId2, type) VALUES (?, ?, ?)`;
    db.run(query, [personId1, personId2, type], function(err) {
        if (err) {
            console.error('Error adding relationship: ' + err.message);
        } else {
            console.log(`Relationship added with ID: ${this.lastID}`);
        }
    });
}

addRelationship(1, 2, 'child');