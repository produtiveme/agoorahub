document.addEventListener('DOMContentLoaded', () => {

    // --- DADOS GLOBAIS (do cache) ---
    let dataAtivos = [];
    let tipoCores = {};

    // --- ESTADO LOCAL DA PÁGINA ---
    let ativoFilters = { name: '', type: 'all', classification: 'all' };

    // --- ELEMENTOS DO DOM ---
    const ativosListContainer = document.getElementById('ativos-list');
    const ativoNameFilter = document.getElementById('ativo-name-filter');
    const ativoTypeFilter = document.getElementById('ativo-type-filter');
    const ativoClassificationFilter = document.getElementById('ativo-classification-filter');

    
    // --- RENDERIZAÇÃO ---
    
    function renderAtivosPanel() {
        // Popula os filtros na primeira renderização (se ainda não foram populados)
        if (ativoTypeFilter.options.length <= 1) {
            const tiposUnicos = ['all', ...new Set(dataAtivos.map(a => a.Tipo).filter(Boolean))];
            ativoTypeFilter.innerHTML = tiposUnicos.map(tipo => `<option value="${tipo}">${tipo === 'all' ? 'Todos os Tipos' : tipo}</option>`).join('');
            
            const classificacoesUnicas = ['all', ...new Set(dataAtivos.map(a => a.Classificacao).filter(Boolean))];
            ativoClassificationFilter.innerHTML = classificacoesUnicas.map(c => `<option value="${c}">${c === 'all' ? 'Todas as Classificações' : c}</option>`).join('');
        }

        // Aplica os filtros
        const nomeQuery = ativoFilters.name.toLowerCase();
        const filteredAtivos = dataAtivos.filter(ativo => {
            const matchNome = !nomeQuery || ativo.Nome_Ativo.toLowerCase().includes(nomeQuery);
            const matchTipo = ativoFilters.type === 'all' || ativo.Tipo === ativoFilters.type;
            const matchClassificacao = ativoFilters.classification === 'all' || ativo.Classificacao === ativoFilters.classification;
            return matchNome && matchTipo && matchClassificacao;
        });

        // Renderiza os cards
        ativosListContainer.innerHTML = '';
        if (filteredAtivos.length === 0) {
            ativosListContainer.innerHTML = '<p>Nenhum ativo encontrado com estes filtros.</p>';
            return;
        }

        filteredAtivos.forEach(ativo => {
            const temValorZerado = ativo['Valor Hora'] === 0 || ativo['Valor Diária'] === 0;
            const card = document.createElement('div');
            card.className = 'ativo-card';
            card.dataset.ativoId = ativo.ID_Ativo;
            
            if (temValorZerado) { card.style.borderColor = 'var(--error-color)'; } 
            else if (ativo.Tipo && tipoCores[ativo.Tipo]) { card.style.borderColor = tipoCores[ativo.Tipo]; }
            
            const valorHora = (ativo['Valor Hora'] || ativo['Valor Hora'] === 0) ? formatCurrency(ativo['Valor Hora']) : 'N/D';
            const valorDiaria = (ativo['Valor Diária'] || ativo['Valor Diária'] === 0) ? formatCurrency(ativo['Valor Diária']) : 'N/D';

            card.innerHTML = `
                <div class="ativo-card-header">
                    <div class="item-card-title">
                        <h3>${ativo.Nome_Ativo}</h3>
                        <span class="item-tag" style="background-color: ${tipoCores[ativo.Tipo] || '#ccc'}">${ativo.Tipo || 'Sem Tipo'}</span>
                    </div>
                    <p><strong>Classificação:</strong> ${ativo.Classificacao || 'N/D'}</p>
                    <div class="ativo-valores">
                        <span class="valor-badge">Hora: ${valorHora}</span>
                        <span class="valor-badge">Diária: ${valorDiaria}</span>
                    </div>
                </div>`;
            ativosListContainer.appendChild(card);
        });

        // Adiciona listeners aos cards criados
        ativosListContainer.querySelectorAll('.ativo-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const ativoId = e.currentTarget.dataset.ativoId;
                // Navega para a página de detalhes do ativo
                window.location.href = `detalhe-ativo.html?id=${ativoId}`;
            });
        });
    }

    // --- EVENT LISTENERS ---

    ativoNameFilter.addEventListener('input', (e) => { 
        ativoFilters.name = e.target.value; 
        renderAtivosPanel(); 
    });
    
    ativoTypeFilter.addEventListener('change', (e) => { 
        ativoFilters.type = e.target.value; 
        renderAtivosPanel(); 
    });
    
    ativoClassificationFilter.addEventListener('change', (e) => { 
        ativoFilters.classification = e.target.value; 
        renderAtivosPanel(); 
    });

    // --- INICIALIZAÇÃO DA PÁGINA ---

    async function initializePage() {
        try {
            const data = await fetchAllData();
            dataAtivos = data.dataAtivos;
            tipoCores = data.tipoCores;
            
            renderAtivosPanel();

        } catch (error) {
            ativosListContainer.innerHTML = `<p class="error-message">Não foi possível carregar os ativos. Verifique a sua ligação ou os endpoints dos webhooks.</p>`;
        }
    }

    initializePage();
});