class CalendarReport {
    constructor() {
        this.currentDate = new Date();
        this.currentYear = this.currentDate.getFullYear();
        this.currentMonth = this.currentDate.getMonth() + 1;
        this.harvestRequests = [];
        this.calendarData = [];
        this.requestsByDate = {};
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.setCurrentMonth();
        await this.loadData();
        this.renderCalendar();
        this.renderDetailList();
    }
    
    setupEventListeners() {
        const monthSelect = document.getElementById('monthSelect');
        monthSelect.addEventListener('change', (e) => {
            const [year, month] = e.target.value.split('-');
            this.currentYear = parseInt(year);
            this.currentMonth = parseInt(month);
            this.loadData();
        });
        
        // Print event listeners
        window.addEventListener('beforeprint', () => {
            this.preparePrintView();
        });
        
        window.addEventListener('afterprint', () => {
            this.restoreScreenView();
        });
    }
    
    setCurrentMonth() {
        const monthSelect = document.getElementById('monthSelect');
        const monthValue = `${this.currentYear}-${this.currentMonth.toString().padStart(2, '0')}`;
        monthSelect.value = monthValue;
    }
    
    async loadData() {
        try {
            // Load harvest requests for the selected month
            const response = await fetch('/api/admin/harvest-requests', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load harvest requests');
            }
            
            const data = await response.json();
            
            // Filter requests for the selected month
            this.harvestRequests = data.filter(request => {
                const requestDate = new Date(request.delivery_date);
                return requestDate.getFullYear() === this.currentYear && 
                       requestDate.getMonth() + 1 === this.currentMonth &&
                       request.status === 'approved';
            });
            
            this.processCalendarData();
            this.updateSummary();
            this.renderCalendar();
            this.renderDetailList();
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('データの読み込みに失敗しました');
        }
    }
    
    processCalendarData() {
        // Group requests by date
        this.requestsByDate = {};
        this.harvestRequests.forEach(request => {
            const dateKey = request.delivery_date;
            if (!this.requestsByDate[dateKey]) {
                this.requestsByDate[dateKey] = [];
            }
            this.requestsByDate[dateKey].push(request);
        });
        
        // Generate calendar data
        this.calendarData = this.generateCalendarData();
    }
    
    generateCalendarData() {
        const firstDay = new Date(this.currentYear, this.currentMonth - 1, 1);
        const lastDay = new Date(this.currentYear, this.currentMonth, 0);
        const startCalendar = new Date(firstDay);
        startCalendar.setDate(startCalendar.getDate() - firstDay.getDay());
        
        const weeks = [];
        let currentWeek = [];
        
        for (let i = 0; i < 42; i++) {
            const currentDate = new Date(startCalendar);
            currentDate.setDate(startCalendar.getDate() + i);
            
            const isCurrentMonth = currentDate.getMonth() + 1 === this.currentMonth;
            const dateKey = currentDate.toISOString().split('T')[0];
            const dayRequests = this.requestsByDate[dateKey] || [];
            
            const dayData = {
                date: currentDate.getDate(),
                fullDate: dateKey,
                isCurrentMonth: isCurrentMonth,
                requests: dayRequests,
                totalQuantity: dayRequests.reduce((sum, req) => sum + req.quantity, 0)
            };
            
            currentWeek.push(dayData);
            
            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        }
        
        return weeks;
    }
    
    updateSummary() {
        const totalRequests = this.harvestRequests.length;
        const totalQuantity = this.harvestRequests.reduce((sum, req) => sum + req.quantity, 0);
        
        // Update summary cards
        document.getElementById('totalRequests').textContent = totalRequests;
        document.getElementById('totalQuantity').textContent = totalQuantity;
        
        // Update header
        const monthName = new Date(this.currentYear, this.currentMonth - 1).toLocaleDateString('ja-JP', { 
            year: 'numeric', 
            month: 'long' 
        });
        
        document.getElementById('monthTitle').textContent = `${monthName} 納品予定カレンダー`;
        document.getElementById('monthSummary').textContent = `総申請数: ${totalRequests}件 | 総数量: ${totalQuantity}個`;
    }
    
    renderCalendar() {
        const calendarGrid = document.getElementById('calendarGrid');
        
        // Clear existing calendar cells (keep headers)
        const existingCells = calendarGrid.querySelectorAll('.calendar-cell');
        existingCells.forEach(cell => cell.remove());
        
        // Add calendar cells
        this.calendarData.forEach(week => {
            week.forEach(day => {
                const dayElement = this.createCalendarCell(day);
                calendarGrid.appendChild(dayElement);
            });
        });
    }
    
    createCalendarCell(day) {
        const cellDiv = document.createElement('div');
        cellDiv.className = `calendar-cell ${day.isCurrentMonth ? '' : 'other-month'}`;
        
        const dateDiv = document.createElement('div');
        dateDiv.className = 'calendar-date';
        dateDiv.textContent = day.date;
        cellDiv.appendChild(dateDiv);
        
        // Add requests
        day.requests.forEach(request => {
            const requestDiv = document.createElement('div');
            requestDiv.className = 'calendar-item';
            
            const userSpan = document.createElement('span');
            userSpan.className = 'calendar-item-user';
            userSpan.textContent = request.user_name.substring(0, 4);
            
            const quantitySpan = document.createElement('span');
            quantitySpan.className = 'calendar-item-quantity';
            quantitySpan.textContent = request.quantity;
            
            requestDiv.appendChild(userSpan);
            requestDiv.appendChild(quantitySpan);
            cellDiv.appendChild(requestDiv);
        });
        
        // Add total if there are multiple requests
        if (day.totalQuantity > 0 && day.requests.length > 1) {
            const totalDiv = document.createElement('div');
            totalDiv.className = 'calendar-total';
            totalDiv.textContent = day.totalQuantity;
            cellDiv.appendChild(totalDiv);
        }
        
        return cellDiv;
    }
    
    renderDetailList() {
        const detailList = document.getElementById('detailList');
        detailList.innerHTML = '';
        
        if (this.harvestRequests.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="4" class="px-6 py-8 text-center text-gray-500">
                    ${new Date(this.currentYear, this.currentMonth - 1).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })}の納品予定はありません
                </td>
            `;
            detailList.appendChild(row);
            return;
        }
        
        // Sort requests by date
        const sortedRequests = [...this.harvestRequests].sort((a, b) => 
            new Date(a.delivery_date) - new Date(b.delivery_date)
        );
        
        sortedRequests.forEach((request, index) => {
            const row = document.createElement('tr');
            row.className = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
            
            const requestDate = new Date(request.delivery_date);
            const formattedDate = requestDate.toLocaleDateString('ja-JP', { 
                month: 'numeric', 
                day: 'numeric', 
                weekday: 'short' 
            });
            
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formattedDate}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${request.user_name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${request.vegetable_item}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">${request.quantity}個</td>
            `;
            
            detailList.appendChild(row);
        });
    }
    
    preparePrintView() {
        // Update print elements
        const monthName = new Date(this.currentYear, this.currentMonth - 1).toLocaleDateString('ja-JP', { 
            year: 'numeric', 
            month: 'long' 
        });
        
        const totalRequests = this.harvestRequests.length;
        const totalQuantity = this.harvestRequests.reduce((sum, req) => sum + req.quantity, 0);
        
        document.getElementById('printMonthTitle').textContent = `${monthName} 納品予定一覧`;
        document.getElementById('printTotalRequests').textContent = `総申請数: ${totalRequests}件`;
        document.getElementById('printTotalQuantity').textContent = `総数量: ${totalQuantity}個`;
        
        // Generate print calendar table
        this.renderPrintCalendar();
    }
    
    renderPrintCalendar() {
        const printCalendarBody = document.getElementById('printCalendarBody');
        printCalendarBody.innerHTML = '';
        
        this.calendarData.forEach(week => {
            const row = document.createElement('tr');
            
            week.forEach(day => {
                const cell = document.createElement('td');
                cell.className = `calendar-cell ${day.isCurrentMonth ? '' : 'other-month'}`;
                
                let cellContent = `<div class="calendar-date">${day.date}</div>`;
                
                if (day.requests.length > 0) {
                    day.requests.forEach(request => {
                        cellContent += `
                            <div class="calendar-item">
                                ${request.user_name}: ${request.vegetable_item.substring(0, 4)} ${request.quantity}個
                            </div>
                        `;
                    });
                    
                    if (day.requests.length > 1) {
                        cellContent += `
                            <div class="calendar-item" style="font-weight: bold; background-color: #4caf50; color: white;">
                                合計: ${day.totalQuantity}個
                            </div>
                        `;
                    }
                }
                
                cell.innerHTML = cellContent;
                row.appendChild(cell);
            });
            
            printCalendarBody.appendChild(row);
        });
    }
    
    restoreScreenView() {
        // Print view is automatically handled by CSS media queries
    }
    
    showError(message) {
        console.error(message);
        // You could add a toast notification here
    }
}

// Global functions for buttons
function exportToPDF() {
    // 印刷専用の要素を表示
    const printElements = document.querySelectorAll('.print-only');
    printElements.forEach(el => {
        el.style.display = 'block';
    });
    
    // 印刷実行
    setTimeout(() => {
        window.print();
        
        // 印刷後に元に戻す
        setTimeout(() => {
            printElements.forEach(el => {
                el.style.display = 'none';
            });
        }, 1000);
    }, 100);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CalendarReport();
});