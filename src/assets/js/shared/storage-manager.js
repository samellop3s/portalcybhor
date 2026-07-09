// ============================================
// Local Storage Manager for Tasks & Ideas
// ============================================
// Gerencia a persistência local de tarefas e ideias
// Funciona como backup/cache para sincronização com Firebase

class StorageManager {
  constructor() {
    this.tasksKey = 'cybhor_tasks';
    this.ideasKey = 'cybhor_ideas';
    this.stagesKey = 'cybhor_stages';
    this.syncStatusKey = 'cybhor_sync_status';
  }

  // ==========================================
  // TASKS MANAGEMENT
  // ==========================================

  /**
   * Salva todas as tarefas no localStorage
   * @param {Object} tasks - Objeto com tarefas
   */
  saveTasks(tasks) {
    try {
      localStorage.setItem(this.tasksKey, JSON.stringify(tasks));
      this.updateSyncStatus('tasks', new Date().toISOString());
    } catch (error) {
      console.error('Erro ao salvar tarefas no localStorage:', error);
    }
  }

  /**
   * Carrega todas as tarefas do localStorage
   * @returns {Object} Objeto com tarefas ou {} se vazio
   */
  loadTasks() {
    try {
      const stored = localStorage.getItem(this.tasksKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Erro ao carregar tarefas do localStorage:', error);
      return {};
    }
  }

  /**
   * Adiciona ou atualiza uma tarefa no localStorage
   * @param {string} taskId - ID da tarefa
   * @param {Object} taskData - Dados da tarefa
   */
  saveTask(taskId, taskData) {
    try {
      const tasks = this.loadTasks();
      tasks[taskId] = taskData;
      this.saveTasks(tasks);
    } catch (error) {
      console.error('Erro ao salvar tarefa no localStorage:', error);
    }
  }

  /**
   * Remove uma tarefa do localStorage
   * @param {string} taskId - ID da tarefa
   */
  deleteTask(taskId) {
    try {
      const tasks = this.loadTasks();
      delete tasks[taskId];
      this.saveTasks(tasks);
    } catch (error) {
      console.error('Erro ao deletar tarefa do localStorage:', error);
    }
  }

  /**
   * Limpa todas as tarefas do localStorage
   */
  clearTasks() {
    try {
      localStorage.removeItem(this.tasksKey);
    } catch (error) {
      console.error('Erro ao limpar tarefas do localStorage:', error);
    }
  }

  // ==========================================
  // IDEAS MANAGEMENT
  // ==========================================

  /**
   * Salva todas as ideias no localStorage
   * @param {Object} ideas - Objeto com ideias
   */
  saveIdeas(ideas) {
    try {
      localStorage.setItem(this.ideasKey, JSON.stringify(ideas));
      this.updateSyncStatus('ideas', new Date().toISOString());
    } catch (error) {
      console.error('Erro ao salvar ideias no localStorage:', error);
    }
  }

  /**
   * Carrega todas as ideias do localStorage
   * @returns {Object} Objeto com ideias ou {} se vazio
   */
  loadIdeas() {
    try {
      const stored = localStorage.getItem(this.ideasKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Erro ao carregar ideias do localStorage:', error);
      return {};
    }
  }

  /**
   * Adiciona ou atualiza uma ideia no localStorage
   * @param {string} ideaId - ID da ideia
   * @param {Object} ideaData - Dados da ideia
   */
  saveIdea(ideaId, ideaData) {
    try {
      const ideas = this.loadIdeas();
      ideas[ideaId] = ideaData;
      this.saveIdeas(ideas);
    } catch (error) {
      console.error('Erro ao salvar ideia no localStorage:', error);
    }
  }

  /**
   * Remove uma ideia do localStorage
   * @param {string} ideaId - ID da ideia
   */
  deleteIdea(ideaId) {
    try {
      const ideas = this.loadIdeas();
      delete ideas[ideaId];
      this.saveIdeas(ideas);
    } catch (error) {
      console.error('Erro ao deletar ideia do localStorage:', error);
    }
  }

  /**
   * Limpa todas as ideias do localStorage
   */
  clearIdeas() {
    try {
      localStorage.removeItem(this.ideasKey);
    } catch (error) {
      console.error('Erro ao limpar ideias do localStorage:', error);
    }
  }

  // ==========================================
  // STAGES MANAGEMENT
  // ==========================================

  /**
   * Salva todos os estágios no localStorage
   * @param {Object} stages - Objeto com estágios
   */
  saveStages(stages) {
    try {
      localStorage.setItem(this.stagesKey, JSON.stringify(stages));
      this.updateSyncStatus('stages', new Date().toISOString());
    } catch (error) {
      console.error('Erro ao salvar estágios no localStorage:', error);
    }
  }

  /**
   * Carrega todos os estágios do localStorage
   * @returns {Object} Objeto com estágios ou {} se vazio
   */
  loadStages() {
    try {
      const stored = localStorage.getItem(this.stagesKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Erro ao carregar estágios do localStorage:', error);
      return {};
    }
  }

  /**
   * Limpa todos os estágios do localStorage
   */
  clearStages() {
    try {
      localStorage.removeItem(this.stagesKey);
    } catch (error) {
      console.error('Erro ao limpar estágios do localStorage:', error);
    }
  }

  // ==========================================
  // SYNC STATUS TRACKING
  // ==========================================

  /**
   * Atualiza o status de sincronização
   * @param {string} type - Tipo de dado (tasks, ideas, stages)
   * @param {string} timestamp - Timestamp da última sincronização
   */
  updateSyncStatus(type, timestamp) {
    try {
      const status = this.getSyncStatus();
      status[type] = timestamp;
      localStorage.setItem(this.syncStatusKey, JSON.stringify(status));
    } catch (error) {
      console.error('Erro ao atualizar status de sincronização:', error);
    }
  }

  /**
   * Obtém o status de sincronização
   * @returns {Object} Objeto com timestamps de sincronização
   */
  getSyncStatus() {
    try {
      const stored = localStorage.getItem(this.syncStatusKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Erro ao obter status de sincronização:', error);
      return {};
    }
  }

  /**
   * Obtém o timestamp da última sincronização de um tipo
   * @param {string} type - Tipo de dado (tasks, ideas, stages)
   * @returns {string} Timestamp ISO ou null
   */
  getLastSyncTime(type) {
    const status = this.getSyncStatus();
    return status[type] || null;
  }

  // ==========================================
  // UTILITY FUNCTIONS
  // ==========================================

  /**
   * Limpa tudo do localStorage (cuidado!)
   */
  clearAll() {
    try {
      localStorage.removeItem(this.tasksKey);
      localStorage.removeItem(this.ideasKey);
      localStorage.removeItem(this.stagesKey);
      localStorage.removeItem(this.syncStatusKey);
      console.log('StorageManager: Todos os dados foram limpos');
    } catch (error) {
      console.error('Erro ao limpar tudo do localStorage:', error);
    }
  }

  /**
   * Obtém o tamanho total dos dados armazenados
   * @returns {Object} Objeto com tamanho em bytes e formato legível
   */
  getStorageSize() {
    try {
      const tasks = localStorage.getItem(this.tasksKey)?.length || 0;
      const ideas = localStorage.getItem(this.ideasKey)?.length || 0;
      const stages = localStorage.getItem(this.stagesKey)?.length || 0;
      const status = localStorage.getItem(this.syncStatusKey)?.length || 0;
      
      const totalBytes = tasks + ideas + stages + status;
      const totalKB = (totalBytes / 1024).toFixed(2);
      
      return {
        bytes: totalBytes,
        kilobytes: totalKB,
        readable: `${totalKB} KB`
      };
    } catch (error) {
      console.error('Erro ao calcular tamanho do storage:', error);
      return { bytes: 0, kilobytes: '0', readable: '0 KB' };
    }
  }

  /**
   * Exporta todos os dados para um arquivo JSON
   * Útil para backup manual
   */
  exportData() {
    try {
      const data = {
        tasks: this.loadTasks(),
        ideas: this.loadIdeas(),
        stages: this.loadStages(),
        syncStatus: this.getSyncStatus(),
        exportedAt: new Date().toISOString()
      };
      return data;
    } catch (error) {
      console.error('Erro ao exportar dados:', error);
      return null;
    }
  }

  /**
   * Importa dados de um arquivo JSON
   * @param {Object} data - Objeto de dados exportados
   */
  importData(data) {
    try {
      if (data.tasks) this.saveTasks(data.tasks);
      if (data.ideas) this.saveIdeas(data.ideas);
      if (data.stages) this.saveStages(data.stages);
      console.log('StorageManager: Dados importados com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao importar dados:', error);
      return false;
    }
  }
}

// Exportar instância singleton para uso em módulos
const storageManager = new StorageManager();
export default storageManager;
