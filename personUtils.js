/**
 * Utility functions for person card data and profile information
 */

/**
 * Calculate age from birth date (and optional death date)
 * @param {string} birthDate - ISO format date string (YYYY-MM-DD)
 * @param {string} deathDate - Optional ISO format date string (YYYY-MM-DD)
 * @returns {number|null} Age in years, or null if invalid date
 */
function calculateAge(birthDate, deathDate = null) {
    if (!birthDate) return null;
    
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return null;
    
    const endDate = deathDate ? new Date(deathDate) : new Date();
    if (deathDate && isNaN(endDate.getTime())) return null;
    
    let age = endDate.getFullYear() - birth.getFullYear();
    const monthDiff = endDate.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && endDate.getDate() < birth.getDate())) {
        age--;
    }
    
    return age >= 0 ? age : null;
}

/**
 * Validate date format and logic (birth before death, not in future, etc.)
 * @param {string} birthDate - ISO format date string
 * @param {string} deathDate - Optional ISO format date string
 * @returns {object} {valid: boolean, errors: string[]}
 */
function validateDates(birthDate, deathDate = null) {
    const errors = [];
    const today = new Date();
    
    if (!birthDate) {
        errors.push('Birth date is required');
        return { valid: false, errors };
    }
    
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) {
        errors.push('Invalid birth date format');
        return { valid: false, errors };
    }
    
    if (birth > today) {
        errors.push('Birth date cannot be in the future');
    }
    
    if (deathDate) {
        const death = new Date(deathDate);
        if (isNaN(death.getTime())) {
            errors.push('Invalid death date format');
        } else {
            if (death > today) {
                errors.push('Death date cannot be in the future');
            }
            if (death < birth) {
                errors.push('Death date must be after birth date');
            }
        }
    }
    
    return { valid: errors.length === 0, errors };
}

/**
 * Validate gender value
 * @param {string} gender - Gender value to validate
 * @returns {boolean} True if valid
 */
function validateGender(gender) {
    return ['male', 'female', 'nonbinary', 'other'].includes(gender);
}

/**
 * Validate relationship type
 * @param {string} type - Relationship type to validate
 * @returns {boolean} True if valid
 */
function validateRelationshipType(type) {
    return ['parent', 'spouse', 'sibling'].includes(type);
}

/**
 * Validate image URL format
 * @param {string} imageUrl - URL to validate
 * @returns {boolean} True if valid URL format
 */
function validateImageUrl(imageUrl) {
    if (!imageUrl) return true; // Optional field
    try {
        new URL(imageUrl);
        return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(imageUrl) || 
               imageUrl.includes('picsum') || 
               imageUrl.includes('placeholder');
    } catch (e) {
        return false;
    }
}

/**
 * Format person card data with computed fields
 * @param {object} person - Person database record
 * @param {object} relationships - Optional relationships data
 * @returns {object} Enhanced person object for frontend
 */
function formatPersonCard(person, relationships = []) {
    if (!person) return null;
    
    const age = calculateAge(person.birthDate, person.deathDate);
    const status = person.deathDate ? 'deceased' : 'living';
    
    // Filter relationships for this person
    const relatives = relationships.filter(r => 
        r.personId1 === person.id || r.personId2 === person.id
    );
    
    return {
        id: person.id,
        name: person.name,
        birthDate: person.birthDate,
        deathDate: person.deathDate,
        age,
        status,
        gender: person.gender,
        image: person.image || null,
        parentId: person.parentId,
        relationshipCount: relatives.length,
        childrenCount: relatives.filter(r => r.type === 'parent' && r.personId1 === person.id).length,
        hasPartner: relatives.some(r => r.type === 'spouse' && (r.personId1 === person.id || r.personId2 === person.id)),
        initials: getInitials(person.name)
    };
}

/**
 * Get person initials for avatar fallback
 * @param {string} name - Full name
 * @returns {string} Up to 2 initials
 */
function getInitials(name) {
    if (!name) return '?';
    return name
        .split(' ')
        .slice(0, 2)
        .map(word => word[0])
        .join('')
        .toUpperCase();
}

/**
 * Get formatted date string for display
 * @param {string} dateStr - ISO format date string
 * @returns {string} Formatted date (e.g., "Jan 15, 1980")
 */
function formatDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

module.exports = {
    calculateAge,
    validateDates,
    validateGender,
    validateRelationshipType,
    validateImageUrl,
    formatPersonCard,
    getInitials,
    formatDate
};
