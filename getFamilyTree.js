const db = require('../database');

function getFamilyTree(personId) {
    const query = `
        SELECT p1.name AS person, p2.name AS relative, r.type FROM Relationship r
        JOIN Person p1 ON r.personId1 = p1.id
        JOIN Person p2 ON r.personId2 = p2.id
        WHERE p1.id = ? OR p2.id = ?`
        ;

    db.all(query, [personId, personId], (err, rows) => {
        if (err) {
            console.error('Error fetching family tree: ' + err.message);
        } else {
            console.log('Family Tree:', rows);
        }
    });
}

getFamilyTree(1);