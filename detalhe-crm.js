document.addEventListener('DOMContentLoaded', () => {

    // --- DADOS GLOBAIS (do cache) ---
    let dataCRM = [];

    // --- ESTADO LOCAL DA PÁGINA ---
    let currentCrmId = null;
    let currentCrm = null;

    // --- ELEMENTOS DO DOM ---
    const backToCrmPanelBtn = document.getElementById('back-to-crm-panel-btn');
    const crmDetailTitle = document.getElementById('crm-detail-title');
    const openNotionCrmBtn = document.getElementById('open-notion-crm-btn');
    const crmDetailInfo = document.getElementById('crm-detail-info');
    const mainView = document.getElementById('crm-details-view');

    
    // --- RENDERIZAÇÃO ---
    
    function renderCRMDetails() {
        if (!currentCrm) return;

        crmDetailTitle.textContent = currentCrm.Nome_CRM;
        
        crmDetailInfo.innerHTML = `
            <div class="detail-item"><strong>Classificação</strong> ${currentCrm.Classificacao || 'N/D'}</div>
            <div class="detail-item"><strong>Status</strong> ${currentCrm.Status || 'N/D'}</div>
            <div class="detail-item"><strong>Telefone</strong> ${currentCrm.Telefone || 'N/D'}</div>
            <div class="detail-item"><strong>E-mail</strong> ${currentCrm.Email || 'N/D'}</div>
            <div class="detail-item"><strong>CPF/CNPJ</strong> ${currentCrm['CPF-CNPJ'] || 'N/D'}</div>
            <div class="detail-item"><strong>Site</strong> ${currentCrm.Site || 'N/D'}</div>
            <div class="detail-item" style="grid-column: 1 / -1;">
                <strong>Endereço</strong> ${currentCrm.Endereco_Completo || 'Nenhum endereço fornecido.'}
            </div>
        `;
    }

    // --- EVENT LISTENERS ---

    backToCrmPanelBtn.addEventListener('click', () => {
        window.location.href = 'crm.html';
    });

    // --- INICIALIZAÇÃO DA PÁGINA ---

    async function initializePage() {
        currentCrmId = getIdFromUrl();
        if (!currentCrmId) {
            alert("Nenhum ID de CRM fornecido. Redirecionando para o painel.");
            window.location.href = 'crm.html';
            return;
        }

        try {
            const data = await fetchAllData();
            dataCRM = data.dataCRM;
            
            currentCrm = dataCRM.find(c => c.ID_CRM_Notion === currentCrmId);

            if (!currentCrm) {
                alert("CRM não encontrado. Redirecionando para o painel.");
                window.location.href = 'crm.html';
                return;
            }
            
            renderCRMDetails();

            // Adiciona o listener para o botão do Notion
            openNotionCrmBtn.addEventListener('click', () => {
                if (currentCrm) {
                    window.open(currentCrm.URL_Notion, '_blank');
                }
            });

        } catch (error) {
            mainView.innerHTML = `<p class="error-message">Não foi possível carregar os dados. Verifique a sua ligação. <a href="crm.html">Voltar ao Painel</a></p>`;
        }
    }

    initializePage();
});