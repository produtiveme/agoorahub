document.addEventListener('DOMContentLoaded', () => {

    // --- DADOS GLOBAIS (do cache) ---
    let dataCRM = [];
    let classificacaoCores = {};

    // --- ESTADO LOCAL DA PÁGINA ---
    let crmFilters = { name: '', doc: '', classification: 'all' };

    // --- ELEMENTOS DO DOM ---
    const crmListContainer = document.getElementById('crm-list');
    const crmNameFilter = document.getElementById('crm-name-filter');
    const crmDocFilter = document.getElementById('crm-doc-filter');
    const crmClassificationFilter = document.getElementById('crm-classification-filter');

    
    // --- RENDERIZAÇÃO ---
    
    function renderCRMPanel() {
        // Popula o filtro de classificação (se ainda não foi populado)
        if (crmClassificationFilter.options.length <= 1) {
            const classificacoesUnicas = ['all', ...new Set(dataCRM.map(c => c.Classificacao).filter(Boolean))];
            crmClassificationFilter.innerHTML = classificacoesUnicas.map(c => `<option value="${c}">${c === 'all' ? 'Todas as Classificações' : c}</option>`).join('');
        }
        
        // Aplica os filtros
        const nomeQuery = crmFilters.name.toLowerCase();
        const docQuery = crmFilters.doc.toLowerCase();

        const filteredCRM = dataCRM.filter(crm => {
            const matchNome = !nomeQuery || crm.Nome_CRM.toLowerCase().includes(nomeQuery);
            const matchDoc = !docQuery || (crm['CPF-CNPJ'] && crm['CPF-CNPJ'].toLowerCase().includes(docQuery));
            const matchClassificacao = crmFilters.classification === 'all' || crm.Classificacao === crmFilters.classification;
            return matchNome && matchDoc && matchClassificacao;
        });

        // Renderiza os cards
        crmListContainer.innerHTML = '';
        if (filteredCRM.length === 0) {
            crmListContainer.innerHTML = '<p>Nenhum cliente/contato encontrado com estes filtros.</p>';
            return;
        }

        filteredCRM.forEach(crm => {
            const card = document.createElement('div');
            card.className = 'crm-card';
            card.dataset.crmId = crm.ID_CRM_Notion;
            
            card.innerHTML = `
                <div class="crm-card-header">
                    <div class="item-card-title">
                        <h3>${crm.Nome_CRM}</h3>
                        <span class="item-tag" style="background-color: ${classificacaoCores[crm.Classificacao] || '#ccc'}">${crm.Classificacao || 'N/D'}</span>
                    </div>
                    <p>${crm.Telefone || 'Sem telefone'}</p>
                    <p>${crm.Email || 'Sem e-mail'}</p>
                </div>`;
            crmListContainer.appendChild(card);
        });

        // Adiciona listeners aos cards criados
        crmListContainer.querySelectorAll('.crm-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const crmId = e.currentTarget.dataset.crmId;
                // Navega para a página de detalhes do CRM
                window.location.href = `detalhe-crm.html?id=${crmId}`;
            });
        });
    }

    // --- EVENT LISTENERS ---

    crmNameFilter.addEventListener('input', (e) => { 
        crmFilters.name = e.target.value; 
        renderCRMPanel(); 
    });
    
    crmDocFilter.addEventListener('input', (e) => { 
        crmFilters.doc = e.target.value; 
        renderCRMPanel(); 
    });
    
    crmClassificationFilter.addEventListener('change', (e) => { 
        crmFilters.classification = e.target.value; 
        renderCRMPanel(); 
    });

    // --- INICIALIZAÇÃO DA PÁGINA ---

    async function initializePage() {
        try {
            const data = await fetchAllData();
            dataCRM = data.dataCRM;
            classificacaoCores = data.classificacaoCores;
            
            renderCRMPanel();

        } catch (error) {
            crmListContainer.innerHTML = `<p class="error-message">Não foi possível carregar os dados de CRM. Verifique a sua ligação ou os endpoints dos webhooks.</p>`;
        }
    }

    initializePage();
});