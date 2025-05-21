const db = require('./database');

function addRelationship(personId1, personId2, type) {
    const query = `INSERT INTO Relationship (personId1, personId2, type) VALUES (?, ?, ?)`;
    db.run(query, [personId1, personId2, type], function(err) {
        if (err) {
            console.error('Error adding relationship: ' + err.message);
        } else {
            console.log(`Relationship added with ID: ${this.lastID}`);
        
            // If the relationship is a parent-child relationship, update the parentId of the child
            if (type === 'child') {
                const updateQuery = `UPDATE Person SET parentId = ? WHERE id = ?`;
                db.run(updateQuery, [personId1, personId2], function(updateErr) {
                    if (updateErr) {
                        console.error('Error updating parentId: ' + updateErr.message);
                    } else {
                        console.log(`ParentId updated for child with ID: ${personId2}`);
                    }
                });
            }
    
        }
    });
}

addRelationship(1, 2, 'child');