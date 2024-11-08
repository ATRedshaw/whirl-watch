import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const Lists = () => {
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingList, setDeletingList] = useState(null);
  const [sortBy, setSortBy] = useState('last_updated_desc');
  const [filters, setFilters] = useState({
    search: '',
    owner: 'all'  // 'all', 'owned', 'shared'
  });
  const [showManageModal, setShowManageModal] = useState(false);
  const [managingList, setManagingList] = useState(null);
  const [listUsers, setListUsers] = useState(null);
  const [managementError, setManagementError] = useState(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leavingList, setLeavingList] = useState(null);
  const [showRemoveUserModal, setShowRemoveUserModal] = useState(false);
  const [userToRemove, setUserToRemove] = useState(null);

  // Fetch lists on component mount
  useEffect(() => {
    const fetchLists = async () => {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
        const token = localStorage.getItem('token');
        const response = await fetch(`${apiUrl}/api/lists`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setLists(data.lists);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLists();
  }, []);

  // Handle delete list
  const handleDelete = async () => {
    if (!deletingList) return;
    
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/lists/${deletingList}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      setLists(lists.filter(list => list.id !== deletingList));
      setShowDeleteModal(false);
      setDeletingList(null);
    } catch (err) {
      setError(err.message);
    }
  };

  // Add this function to filter the lists
  const getFilteredLists = () => {
    if (!lists) return [];
    
    return lists
      .filter(list => {
        const matchesSearch = list.name.toLowerCase().includes(filters.search.toLowerCase());
        const matchesOwner = filters.owner === 'all' || 
          (filters.owner === 'owned' && list.is_owner) || 
          (filters.owner === 'shared' && !list.is_owner);
        
        return matchesSearch && matchesOwner;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name_asc':
            return a.name.localeCompare(b.name);
          case 'name_desc':
            return b.name.localeCompare(a.name);
          case 'created_desc':
            return new Date(b.created_at) - new Date(a.created_at);
          case 'created_asc':
            return new Date(a.created_at) - new Date(b.created_at);
          case 'last_updated_desc':
            return new Date(b.last_updated) - new Date(a.last_updated);
          case 'last_updated_asc':
            return new Date(a.last_updated) - new Date(a.last_updated);
          case 'items_desc':
            return (b.media_items?.length || 0) - (a.media_items?.length || 0);
          case 'items_asc':
            return (a.media_items?.length || 0) - (b.media_items?.length || 0);
          default:
            return 0;
        }
      });
  };

  // Add this new function to fetch list users
  const fetchListUsers = async (listId) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/lists/${listId}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setListUsers(data);
    } catch (err) {
      setManagementError(err.message);
    }
  };

  // Add this function to handle removing users
  const handleRemoveUser = async () => {
    if (!userToRemove || !managingList) return;
    
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/lists/${managingList.id}/users/${userToRemove.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      // Refresh the users list
      await fetchListUsers(managingList.id);
      setShowRemoveUserModal(false);
      setUserToRemove(null);
    } catch (err) {
      setManagementError(err.message);
    }
  };

  // Add this new function near your other handlers
  const handleLeaveList = async () => {
    if (!leavingList) return;
    
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/lists/${leavingList}/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      // Remove the list from the local state
      setLists(lists.filter(list => list.id !== leavingList));
      setShowLeaveModal(false);
      setLeavingList(null);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white p-8">
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
          <h3 className="text-red-500 font-semibold">Error loading lists</h3>
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white p-4 sm:p-8">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <div className="text-center sm:text-left w-full sm:w-auto">
            <h1 className="text-3xl font-bold mb-2">Your Lists</h1>
            <p className="text-gray-400">Manage your movie and TV show collections</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto justify-center sm:justify-end">
            <button
              onClick={() => navigate('/lists/join')}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors duration-200"
            >
              Join List
            </button>
            <button
              onClick={() => navigate('/lists/create')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200"
            >
              Create List
            </button>
          </div>
        </div>

        {/* Filtration Bar */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search Input */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                placeholder="Search list names..."
                className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Owner Filter */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Owner</label>
              <select
                value={filters.owner}
                onChange={(e) => setFilters(prev => ({ ...prev, owner: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Lists</option>
                <option value="owned">My Lists</option>
                <option value="shared">Shared With Me</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="last_updated_desc">Recently Updated</option>
                <option value="last_updated_asc">Oldest Updated</option>
                <option value="created_desc">Recently Created</option>
                <option value="created_asc">Oldest Created</option>
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
                <option value="items_desc">Most Items</option>
                <option value="items_asc">Least Items</option>
              </select>
            </div>

            {/* Update Clear Filters Button */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({ search: '', owner: 'all' });
                  setSortBy('last_updated_desc');
                }}
                className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors duration-200"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </motion.div>

        {/* Lists Grid */}
        {getFilteredLists().length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getFilteredLists().map(list => (
              <motion.div
                key={list.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold mb-2">{list.name}</h3>
                      <p className="text-sm text-gray-400">{list.description || 'No description'}</p>
                    </div>
                    {/* Delete/Leave Button */}
                    {!list.is_owner && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setLeavingList(list.id);
                          setShowLeaveModal(true);
                        }}
                        className="text-red-400 hover:text-red-300 transition-colors duration-200 p-2"
                        aria-label="Leave list"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </button>
                    )}
                    {list.is_owner && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeletingList(list.id);
                          setShowDeleteModal(true);
                        }}
                        className="text-red-400 hover:text-red-300 transition-colors duration-200 p-2"
                        aria-label="Delete list"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-col gap-1 text-sm text-gray-400">
                      <span>Films & TV Shows: {list.media_items?.length || 0}</span>
                      <span>{list.is_owner ? 'Owner: ' : 'Shared by: '}<span className="text-blue-400">{list.is_owner ? 'You' : list.owner.username}</span></span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/lists/${list.id}`);
                        }}
                        className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors duration-200"
                      >
                        {list.is_owner || list.shared_with_me ? 'Edit List' : 'View List'}
                      </button>
                      {list.is_owner && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setManagingList(list);
                            setShowManageModal(true);
                            fetchListUsers(list.id);
                          }}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors duration-200"
                        >
                          Share & Manage
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-xl font-semibold mb-2">No matches found</h3>
              <p className="text-gray-500">Try adjusting your filters</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-800 rounded-lg p-6 max-w-md w-full"
            >
              <h3 className="text-xl font-semibold mb-4">Delete List</h3>
              <p className="text-gray-400 mb-6">Are you sure you want to delete this list? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
                >
                  Delete
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingList(null);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List Management Modal */}
      <AnimatePresence>
        {showManageModal && managingList && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={() => {
              setShowManageModal(false);
              setManagingList(null);
              setListUsers(null);
              setManagementError(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-800 rounded-lg p-6 max-w-md w-full"
            >
              <h3 className="text-xl font-semibold mb-4">Manage List: {managingList.name}</h3>
              
              {managementError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
                  {managementError}
                </div>
              )}

              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-2">Share Code</h4>
                <div className="bg-slate-700 p-3 rounded-lg text-center">
                  <span className="font-mono">{managingList.share_code}</span>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-2">Users</h4>
                {listUsers ? (
                  <div className="space-y-3">
                    {/* Owner */}
                    <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                      <div>
                        <p className="font-medium">{listUsers.owner.username}</p>
                        <p className="text-sm text-gray-400">Owner</p>
                      </div>
                    </div>
                    
                    {/* Shared Users */}
                    {listUsers.shared_users.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                        <div>
                          <p className="font-medium">{user.username}</p>
                          <p className="text-sm text-gray-400">{user.email}</p>
                        </div>
                        <button
                          onClick={() => {
                            setUserToRemove(user);
                            setShowRemoveUserModal(true);
                          }}
                          className="text-red-400 hover:text-red-300 transition-colors duration-200"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    
                    {listUsers.shared_users.length === 0 && (
                      <p className="text-gray-400 text-center py-3">No shared users yet</p>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setShowManageModal(false);
                  setManagingList(null);
                  setListUsers(null);
                  setManagementError(null);
                }}
                className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors duration-200"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leave Confirmation Modal */}
      <AnimatePresence>
        {showLeaveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={() => setShowLeaveModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-800 rounded-lg p-6 max-w-md w-full"
            >
              <h3 className="text-xl font-semibold mb-4">Leave List</h3>
              <p className="text-gray-400 mb-6">Are you sure you want to leave this list? You'll need a new share code to rejoin.</p>
              <div className="flex gap-3">
                <button
                  onClick={handleLeaveList}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
                >
                  Leave
                </button>
                <button
                  onClick={() => {
                    setShowLeaveModal(false);
                    setLeavingList(null);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Remove User Confirmation Modal */}
      <AnimatePresence>
        {showRemoveUserModal && userToRemove && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={() => {
              setShowRemoveUserModal(false);
              setUserToRemove(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-800 rounded-lg p-6 max-w-md w-full"
            >
              <h3 className="text-xl font-semibold mb-4">Remove User</h3>
              <p className="text-gray-400 mb-6">
                Are you sure you want to remove {userToRemove.username} from this list? They will need a new share code to rejoin.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleRemoveUser}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
                >
                  Remove
                </button>
                <button
                  onClick={() => {
                    setShowRemoveUserModal(false);
                    setUserToRemove(null);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Lists;