// The two role questions the routes ask. One place, so every route answers them the same way.

// The Owner and Admins run the workspace: they can delete any doc and manage members.
const isAdminOrOwner = (user) => user.role === 'Owner' || user.role === 'Admin';

// Guests are outside the workspace: read-only, and only on docs shared with them.
const isGuest = (user) => user.role === 'Guest';

module.exports = { isAdminOrOwner, isGuest };
