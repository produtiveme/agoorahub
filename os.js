document.addEventListener('DOMContentLoaded', () => {
    
    // --- ESTADO LOCAL DA PÁGINA ---
    let dataOS = [];
    let dataHistoricos = [];
    let dataCRM = [];

    // --- ELEMENTOS DO DOM ---
    const osListContainer = document.getElementById('os-list');
    const createOSBtn = document.getElementById('create-new-os-btn');
    
    // Elementos do Modal de OS
    const osModal = document.getElementById('os-modal');
    const osModalCloseBtn = document.getElementById('os-modal-close-btn');
    const osModalCancelBtn = document.getElementById('os-modal-cancel-btn');
    const osModalDiscountInput = document.getElementById('os-modal-discount-input');
    const osModalSaveBtn = document.getElementById('os-modal-save-btn'); // O listener de save é adicionado em showOSModal

    // --- RENDERIZAÇÃO ---

    function renderDashboard() {
        osListContainer.innerHTML = ''; // Limpa os skeletons
        
        if (dataOS.length === 0) {
            osListContainer.innerHTML = '<p>Nenhuma Ordem de Serviço encontrada.</p>';
            return;
        }

        dataOS.forEach(os => {
            // Calcula o valor bruto baseado nos históricos carregados
            const totalValue = dataHistoricos
                .filter(h => h.ID_OS_Vinculada === os.ID_OS)
                .reduce((total, h) => total + (h.Valor_Calculado || 0), 0);
            
            // Encontra o cliente (CRM)
            let crmInfoHtml = '<p><em>Nenhum CRM foi vinculado</em></p>';
            if (os.ID_CRM && os.ID_CRM !== 'SEM CRM') {
                const crm = dataCRM.find(c => c.ID_CRM_Notion === os.ID_CRM);
                if (crm) {
                    crmInfoHtml = `<p><strong>Cliente:</strong> ${crm.Nome_CRM}</p>`;
                }
            }

            const osCard = document.createElement('div');
            osCard.className = 'os-card';
            osCard.innerHTML = `
                <div class="os-card-header">
                    <div>
                        <h3>${os.Nome_OS}</h3>
                        ${crmInfoHtml}
                        <p><strong>Valor Bruto: ${formatCurrency(totalValue)}</strong></p>
                    </div>
                    <div class="os-card-actions">
                        <button class="edit-os-btn" data-os-id="${os.ID_OS}">Editar</button>
                        <button class="view-details-btn" data-os-id="${os.ID_OS}">Ver Detalhes</button>
                    </div>
                </div>`;
            osListContainer.appendChild(osCard);
        });

        // Adiciona listeners aos botões criados
        osListContainer.querySelectorAll('.view-details-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const osId = e.target.dataset.osId;
                // Navega para a página de detalhes com o ID como parâmetro
                window.location.href = `detalhe-os.html?id=${osId}`;
            });
        });
        
        osListContainer.querySelectorAll('.edit-os-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const osId = e.target.dataset.osId;
                const os = dataOS.find(o => o.ID_OS === osId);
                showOSModal('update', os, handleSaveOSClick);
            });
        });
    }

    // --- EVENT LISTENERS ---

    // Listener para o botão de Criar Nova OS
    createOSBtn.addEventListener('click', () => {
        showOSModal('create', null, handleSaveOSClick);
    });

    // Listeners para fechar o modal de OS
    osModalCloseBtn.addEventListener('click', hideOSModal);
    osModalCancelBtn.addEventListener('click', hideOSModal);
    osModal.addEventListener('click', (e) => {
        if (e.target === osModal) hideOSModal();
    });

    // Formatação de input de desconto
    osModalDiscountInput.addEventListener('input', (e) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        e.target.value = formatCurrency(Number(rawValue) / 100);
    });

    /**
     * Função de callback passada para o modal de OS.
     * É chamada quando o botão "Salvar" do modal é clicado.
     */
    async function handleSaveOSClick(payload) {
        const osModalSaveBtn = document.getElementById('os-modal-save-btn');
        const osModalError = document.getElementById('os-modal-error');
        
        osModalSaveBtn.disabled = true;
        osModalSaveBtn.textContent = 'A salvar...';
        osModalError.textContent = '';

        const success = await handleSaveOS(payload);

        if (success) {
            hideOSModal();
            // Recarrega os dados (do cache atualizado) e renderiza novamente
            const { dataOS: newDataOS } = await fetchAllData();
            dataOS = newDataOS;
            renderDashboard();
        } else {
            osModalError.textContent = "Não foi possível salvar. Tente novamente.";
        }

        osModalSaveBtn.disabled = false;
        osModalSaveBtn.textContent = 'Salvar';
    }


    // --- INICIALIZAÇÃO DA PÁGINA ---

    async function initializePage() {
        try {
            // Carrega todos os dados (do cache ou da API)
            const data = await fetchAllData();
            dataOS = data.dataOS;
            dataHistoricos = data.dataHistoricos;
            dataCRM = data.dataCRM;
            
            // Renderiza o painel
            renderDashboard();

        } catch (error) {
            osListContainer.innerHTML = `<p class="error-message">Não foi possível carregar os dados. Verifique a sua ligação ou os endpoints dos webhooks.</p>`;
        }
    }

    initializePage();
});