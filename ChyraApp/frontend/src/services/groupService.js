import api from './api';

class GroupService {
  // Get all user's groups
  async getUserGroups() {
    try {
      console.log('[GROUP_SERVICE] Getting user groups');
      const response = await api.get('/groups');
      console.log('[GROUP_SERVICE] User groups fetched:', response.data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('[GROUP_SERVICE] Get user groups error:', error);
      throw error;
    }
  }

  // Create a new group
  async createGroup(groupData) {
    try {
      console.log('[GROUP_SERVICE] Creating group:', groupData);
      const response = await api.post('/groups', groupData);
      console.log('[GROUP_SERVICE] Group created:', response.data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('[GROUP_SERVICE] Create group error:', error);
      throw error;
    }
  }

  // Get group by ID
  async getGroupById(groupId) {
    try {
      console.log('[GROUP_SERVICE] Fetching group by ID:', groupId);
      const response = await api.get(`/groups/${groupId}`);
      console.log('[GROUP_SERVICE] Group fetched:', response.data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('[GROUP_SERVICE] Get group by ID error:', error);
      throw error;
    }
  }

  // Get group details (alias for getGroupById)
  async getGroupDetails(groupId) {
    try {
      console.log('[GROUP_SERVICE] Fetching group details:', groupId);
      const response = await api.get(`/groups/${groupId}`);
      console.log('[GROUP_SERVICE] Group details fetched:', response.data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('[GROUP_SERVICE] Get group details error:', error);
      throw error;
    }
  }

  // Update group info
  async updateGroup(groupId, updates) {
    try {
      console.log('[GROUP_SERVICE] Updating group:', { groupId, updates });
      const response = await api.put(`/groups/${groupId}`, updates);
      console.log('[GROUP_SERVICE] Group updated:', response.data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('[GROUP_SERVICE] Update group error:', error);
      throw error;
    }
  }

  // Update group info (alias)
  async updateGroupInfo(groupId, updates) {
    try {
      console.log('[GROUP_SERVICE] Updating group info:', { groupId, updates });
      const response = await api.put(`/groups/${groupId}`, updates);
      console.log('[GROUP_SERVICE] Group info updated:', response.data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('[GROUP_SERVICE] Update group info error:', error);
      throw error;
    }
  }

  // Add members to group
  async addMembers(groupId, memberIds) {
    try {
      console.log('[GROUP_SERVICE] Adding members:', { groupId, memberIds });
      const response = await api.post(`/groups/${groupId}/members`, { memberIds });
      console.log('[GROUP_SERVICE] Members added:', response.data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('[GROUP_SERVICE] Add members error:', error);
      throw error;
    }
  }

  // Remove member from group
  async removeMember(groupId, memberId) {
    try {
      console.log('[GROUP_SERVICE] Removing member:', { groupId, memberId });
      const response = await api.delete(`/groups/${groupId}/members/${memberId}`);
      console.log('[GROUP_SERVICE] Member removed:', response.data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('[GROUP_SERVICE] Remove member error:', error);
      throw error;
    }
  }

  // Make member an admin
  async makeAdmin(groupId, memberId) {
    try {
      console.log('[GROUP_SERVICE] Making admin:', { groupId, memberId });
      const response = await api.post(`/groups/${groupId}/admins/${memberId}`);
      console.log('[GROUP_SERVICE] Admin promoted:', response.data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('[GROUP_SERVICE] Make admin error:', error);
      throw error;
    }
  }

  // Remove admin role
  async removeAdmin(groupId, memberId) {
    try {
      console.log('[GROUP_SERVICE] Removing admin:', { groupId, memberId });
      const response = await api.delete(`/groups/${groupId}/admins/${memberId}`);
      console.log('[GROUP_SERVICE] Admin demoted:', response.data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('[GROUP_SERVICE] Remove admin error:', error);
      throw error;
    }
  }

  // Leave group
  async leaveGroup(groupId) {
    try {
      console.log('[GROUP_SERVICE] Leaving group:', groupId);
      const response = await api.post(`/groups/${groupId}/leave`);
      console.log('[GROUP_SERVICE] Left group:', response.data);
      return response.data;
    } catch (error) {
      console.error('[GROUP_SERVICE] Leave group error:', error);
      throw error;
    }
  }

  // Delete group
  async deleteGroup(groupId) {
    try {
      console.log('[GROUP_SERVICE] Deleting group:', groupId);
      const response = await api.delete(`/groups/${groupId}`);
      console.log('[GROUP_SERVICE] Group deleted:', response.data);
      return response.data;
    } catch (error) {
      console.error('[GROUP_SERVICE] Delete group error:', error);
      throw error;
    }
  }

  // Delete message in group
  async deleteMessage(groupId, messageId) {
    try {
      console.log('[GROUP_SERVICE] Deleting message:', { groupId, messageId });
      const response = await api.delete(`/groups/${groupId}/messages/${messageId}`);
      console.log('[GROUP_SERVICE] Message deleted:', response.data);
      return response.data;
    } catch (error) {
      console.error('[GROUP_SERVICE] Delete message error:', error);
      throw error;
    }
  }

  // Delete message in group (alias)
  async deleteGroupMessage(groupId, messageId) {
    try {
      console.log('[GROUP_SERVICE] Deleting group message:', { groupId, messageId });
      const response = await api.delete(`/groups/${groupId}/messages/${messageId}`);
      console.log('[GROUP_SERVICE] Group message deleted:', response.data);
      return response.data;
    } catch (error) {
      console.error('[GROUP_SERVICE] Delete group message error:', error);
      throw error;
    }
  }

  // Update group settings
  async updateSettings(groupId, settings) {
    try {
      console.log('[GROUP_SERVICE] Updating settings:', { groupId, settings });
      const response = await api.patch(`/groups/${groupId}/settings`, settings);
      console.log('[GROUP_SERVICE] Settings updated:', response.data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('[GROUP_SERVICE] Update settings error:', error);
      throw error;
    }
  }

  // Update group settings (alias)
  async updateGroupSettings(groupId, settings) {
    try {
      console.log('[GROUP_SERVICE] Updating group settings:', { groupId, settings });
      const response = await api.patch(`/groups/${groupId}/settings`, settings);
      console.log('[GROUP_SERVICE] Group settings updated:', response.data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('[GROUP_SERVICE] Update group settings error:', error);
      throw error;
    }
  }

  // ==================== SUBGROUP METHODS ====================

  // Create subgroup
  async createSubgroup(groupId, subgroupData) {
    try {
      console.log('[GROUP_SERVICE] Creating subgroup:', { groupId, subgroupData });
      const response = await api.post(`/groups/${groupId}/subgroups`, subgroupData);
      console.log('[GROUP_SERVICE] Subgroup created:', response.data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('[GROUP_SERVICE] Create subgroup error:', error);
      throw error;
    }
  }

  // Get all subgroups of a group
  async getSubgroups(groupId) {
    try {
      console.log('[GROUP_SERVICE] Getting subgroups:', groupId);
      const response = await api.get(`/groups/${groupId}/subgroups`);
      console.log('[GROUP_SERVICE] Subgroups fetched:', response.data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('[GROUP_SERVICE] Get subgroups error:', error);
      throw error;
    }
  }

  // Delete subgroup
  async deleteSubgroup(groupId, subgroupId) {
    try {
      console.log('[GROUP_SERVICE] Deleting subgroup:', { groupId, subgroupId });
      const response = await api.delete(`/groups/${groupId}/subgroups/${subgroupId}`);
      console.log('[GROUP_SERVICE] Subgroup deleted:', response.data);
      return response.data;
    } catch (error) {
      console.error('[GROUP_SERVICE] Delete subgroup error:', error);
      throw error;
    }
  }
}

// Create instance and export both ways for compatibility
const groupService = new GroupService();

export default groupService;
export { groupService };