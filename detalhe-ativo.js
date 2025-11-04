document.addEventListener('DOMContentLoaded', () => {

    // --- DADOS GLOBAIS (do cache) ---
    let dataAtivos = [];
    let dataHistoricos = [];
    let dataOS = [];

    // --- ESTADO LOCAL DA PÁGINA ---
    let currentAtivoId = null;
    let currentAtivo = null;

    // --- ELEMENTOS DO DOM ---
    const backToAtivosPanelBtn = document.getElementById('back-to-ativos-panel-btn');
    const ativoDetailTitle = document.getElementById('ativo-detail-title');
    const ativoDetailInfo = document.getElementById('ativo-detail-info');
    const scheduleContainer = document.getElementById('ativo-detail-schedule');

    // Modal
    const dayDetailsModal = document.getElementById('day-details-modal');
    const dayModalCloseBtn = document.getElementById('day-modal-close-btn');
    const modalTitle = document.getElementById('modal-title');
    const modalBodyDayDetails = document.getElementById('modal-body-day-details');


    // --- RENDERIZAÇÃO ---

    function renderAtivoDetails() {
        if (!currentAtivo) return;

        ativoDetailTitle.textContent = currentAtivo.Nome_Ativo;
        ativoDetailInfo.innerHTML = `
            <div class="detail-item"><strong>Classificação</strong> ${currentAtivo.Classificacao || 'N/D'}</div>
            <div class="detail-item"><strong>Situação</strong> ${currentAtivo.Situação || 'N/D'}</div>
            <div class="detail-item"><strong>Tipo</strong> ${currentAtivo.Tipo || 'N/D'}</div>
            <div class="detail-item"><strong>Valor Hora</strong> ${formatCurrency(currentAtivo['Valor Hora'])}</div>
            <div class="detail-item"><strong>Valor Diária</strong> ${formatCurrency(currentAtivo['Valor Diária'])}</div>
            <div class="detail-item" style="grid-column: 1 / -1;">
                <strong>Descrição</strong> ${currentAtivo['Descrição'] || 'Nenhuma descrição fornecida.'}
            </div>
        `;

        // Renderiza o calendário inicial
        const initialDate = new Date();
        scheduleContainer.innerHTML = generateCalendarHTML(currentAtivoId, initialDate.getFullYear(), initialDate.getMonth());
        
        // Adiciona listeners aos botões e dias do calendário
        addCalendarListeners();
    }

    // --- LÓGICA DO CALENDÁRIO ---

    function addCalendarListeners() {
        scheduleContainer.querySelector('.prev-month').addEventListener('click', () => updateCalendar(-1));
        scheduleContainer.querySelector('.next-month').addEventListener('click', () => updateCalendar(1));
        scheduleContainer.querySelector('.calendar-grid').addEventListener('click', handleDayClick);
    }

    function generateCalendarHTML(ativoId, year, month) {
        const historicosDoAtivo = dataHistoricos.filter(h => h.ID_Ativo === ativoId);
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        let html = `
            <div class="calendar" data-year="${year}" data-month="${month}" data-ativo-id="${ativoId}">
                <div class="calendar-header">
                    <button class="prev-month">&lt;</button>
                    <h4>${monthNames[month]} ${year}</h4>
                    <button class="next-month">&gt;</button>
                </div>
                <div class="calendar-grid">
        `;
        
        daysOfWeek.forEach(day => html += `<div class="calendar-day-name">${day}</div>`);
        
        for (let i = 0; i < firstDay.getDay(); i++) { 
            html += `<div class="calendar-day"></div>`; 
        }
        
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const currentDayStart = new Date(year, month, day, 0, 0, 0, 0);
            const currentDayEnd = new Date(year, month, day, 23, 59, 59, 999);
            
            // Verifica se há *algum* histórico que se sobrepõe a este dia
            const isAllocated = historicosDoAtivo.some(h => 
                new Date(h.Inicio_Historico) <= currentDayEnd && 
                new Date(h.Fim_Historico) >= currentDayStart
            );
            
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            html += `
                <div class="calendar-day in-month ${isAllocated ? 'allocated' : ''}" ${isAllocated ? `data-date="${dateString}"` : ''}>
                    ${day}
                </div>
            `;
        }
        
        html += `</div></div>`;
        return html;
    }
    
    function updateCalendar(monthOffset) {
        const calendarDiv = scheduleContainer.querySelector('.calendar');
        const year = parseInt(calendarDiv.dataset.year);
        const month = parseInt(calendarDiv.dataset.month);
        
        const newDate = new Date(year, month + monthOffset, 1);
        
        scheduleContainer.innerHTML = generateCalendarHTML(currentAtivoId, newDate.getFullYear(), newDate.getMonth());
        addCalendarListeners(); // Adiciona listeners ao novo calendário
    }

    function handleDayClick(event) {
        const dayElement = event.target.closest('.allocated');
        if (!dayElement) return;
        
        const dateString = dayElement.dataset.date;
        showDayDetailsModal(dateString);
    }
            
    // --- LÓGICA DO MODAL ---
    
    function showDayDetailsModal(dateString) {
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        
        modalTitle.textContent = `Agendamentos para ${date.toLocaleDateString('pt-BR')}`;
        
        const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
        const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
        
        const bookings = dataHistoricos
            .filter(h => 
                h.ID_Ativo === currentAtivoId && 
                new Date(h.Inicio_Historico) <= dayEnd && 
                new Date(h.Fim_Historico) >= dayStart
            )
            .sort((a,b) => new Date(a.Inicio_Historico) - new Date(b.Inicio_Historico));
        
        modalBodyDayDetails.innerHTML = '';
        if (bookings.length > 0) {
            bookings.forEach(booking => {
                const os = dataOS.find(o => o.ID_OS === booking.ID_OS_Vinculada);
                const start = new Date(booking.Inicio_Historico);
                const end = new Date(booking.Fim_Historico);
                modalBodyDayDetails.innerHTML += `
                    <div class="booking-item">
                        <p><strong>OS:</strong> ${os ? os.Nome_OS : 'Desconhecida'}</p>
                        <p><strong>Horário:</strong> <span>${formatTime(start)} - ${formatTime(end)}</span></p>
                    </div>`;
            });
        }
        
        dayDetailsModal.classList.remove('is-hidden');
    }

    function hideDayDetailsModal() {
        dayDetailsModal.classList.add('is-hidden');
    }

    // --- EVENT LISTENERS ---

    backToAtivosPanelBtn.addEventListener('click', () => {
        window.location.href = 'ativo.html';
    });
    
    dayModalCloseBtn.addEventListener('click', hideDayDetailsModal);
    dayDetailsModal.addEventListener('click', (e) => { 
        if (e.target === dayDetailsModal) hideDayDetailsModal(); 
    }); 

    // --- INICIALIZAÇÃO DA PÁGINA ---

    async function initializePage() {
        currentAtivoId = getIdFromUrl();
        if (!currentAtivoId) {
            alert("Nenhum ativo selecionado. Redirecionando para o painel.");
            window.location.href = 'ativo.html';
            return;
        }

        try {
            const data = await fetchAllData();
            dataAtivos = data.dataAtivos;
            dataHistoricos = data.dataHistoricos;
            dataOS = data.dataOS; // Precisamos das OSs para o modal
            
            currentAtivo = dataAtivos.find(a => a.ID_Ativo === currentAtivoId);

            if (!currentAtivo) {
                alert("Ativo não encontrado. Redirecionando para o painel.");
                window.location.href = 'ativo.html';
                return;
            }
            
            renderAtivoDetails();

        } catch (error) {
            document.getElementById('ativo-details-view').innerHTML = `<p class="error-message">Não foi possível carregar os dados. Verifique a sua ligação. <a href="ativo.html">Voltar ao Painel</a></p>`;
        }
    }

    initializePage();
});