document.addEventListener('DOMContentLoaded', () => {
    const addJobBtn = document.getElementById('add-job-btn');
    const sortBtn = document.getElementById('sort-btn');
    const jobCardsContainer = document.getElementById('job-cards-container');
    const jobCardTemplate = document.getElementById('job-card-template');
    const departureInput = document.getElementById('departure');
    const getLocationBtn = document.getElementById('get-location-btn');
    const mainElement = document.querySelector('main');

    const MAX_JOBS = 3;

    // --- Event Listeners ---
    addJobBtn.addEventListener('click', () => {
        if (jobCardsContainer.children.length < MAX_JOBS) {
            addJobCard();
        }
        if (jobCardsContainer.children.length >= MAX_JOBS) {
            addJobBtn.disabled = true;
        }
    });

    sortBtn.addEventListener('click', sortCards);

    departureInput.addEventListener('input', () => {
        document.querySelectorAll('.job-card').forEach(updateMapButtonState);
    });

    getLocationBtn.addEventListener('click', () => {
        const confirmation = confirm('現在地の情報を取得します。\nなお、現在地情報はブラウザ上でのみ利用され、サーバー等に保存・送信されることはありません。\n許可しますか？');
        if (confirmation) {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        const { latitude, longitude } = position.coords;
                        try {
                            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                            const data = await response.json();
                            if (data && data.display_name) {
                                departureInput.value = data.display_name;
                                // Trigger input event to update map buttons
                                departureInput.dispatchEvent(new Event('input'));
                            } else {
                                alert('住所が取得できませんでした。');
                            }
                        } catch (error) {
                            alert('住所の取得中にエラーが発生しました。');
                        }
                    },
                    () => {
                        alert('現在地が取得できませんでした。');
                    }
                );
            } else {
                alert('お使いのブラウザは位置情報取得に対応していません。');
            }
        }
    });

    // --- Functions ---
    function addJobCard() {
        const cardClone = jobCardTemplate.content.cloneNode(true);
        const newCard = cardClone.querySelector('.job-card');
        jobCardsContainer.appendChild(newCard);
        attachEventListeners(newCard);
        updateMapButtonState(newCard);
        updateAdLayout(); // Update layout when a card is added
    }

    function attachEventListeners(card) {
        card.querySelectorAll('input, select').forEach(element => {
            element.addEventListener('input', () => {
                calculate(card);
                updateMapButtonState(card);
            });
        });

        // --- Details Toggle Listeners ---
        const dormDetailsToggle = card.querySelector('.dorm-details-toggle');
        dormDetailsToggle.addEventListener('click', () => {
            const panel = card.querySelector('.dorm-details-panel');
            panel.classList.toggle('is-visible');
            // Clear inputs when hiding
            if (!panel.classList.contains('is-visible')) {
                panel.querySelectorAll('input, select').forEach(input => input.value = '');
                calculate(card);
            }
        });

        const foodDetailsToggle = card.querySelector('.food-details-toggle');
        foodDetailsToggle.addEventListener('click', () => {
            const panel = card.querySelector('.food-details-panel');
            panel.classList.toggle('is-visible');
            // Clear inputs when hiding
            if (!panel.classList.contains('is-visible')) {
                panel.querySelectorAll('input').forEach(input => input.value = '');
                calculate(card);
            }
        });

        // --- Food Unit Toggle Listeners ---
        const unitToggleContainer = card.querySelector('.unit-toggle-container');
        if (unitToggleContainer) {
            unitToggleContainer.addEventListener('click', (event) => {
                const clickedOption = event.target.closest('.unit-option');
                if (clickedOption) {
                    unitToggleContainer.querySelectorAll('.unit-option').forEach(option => {
                        option.classList.remove('active');
                    });
                    clickedOption.classList.add('active');
                    calculate(card);
                }
            });
        }

        card.querySelector('.map-btn').addEventListener('click', (event) => {
            const mapBtn = event.target;
            const destination = card.querySelector('.job-title').value;
            const origin = departureInput.value;

            // Reset error state
            mapBtn.classList.remove('error');
            mapBtn.textContent = 'ルートと料金を確認';

            if (!origin) {
                mapBtn.classList.add('error');
                mapBtn.textContent = '出発地点を埋めてください';
                return;
            }
            if (!destination) {
                mapBtn.classList.add('error');
                mapBtn.textContent = '仕事先を埋めてください';
                return;
            }
            
            const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
            window.open(url, '_blank');
        });
    }

    function calculate(card) {
        const hourlyWage = parseFloat(card.querySelector('.hourly-wage').value) || 0;
        const utilitiesFee = parseFloat(card.querySelector('.utilities-fee').value) || 0;
        
        // --- Transportation Fee Calculation ---
        const transportProvided = parseFloat(card.querySelector('.transport-provided').value) || 0;
        const transportPaid = parseFloat(card.querySelector('.transport-paid').value) || 0;
        const transportDeficit = transportProvided - transportPaid;
        const transportDeduction = Math.max(0, transportPaid - transportProvided);
        const transportDisplay = Math.min(0, transportDeficit);

        // --- Dorm Fee Calculation ---
        let dormFee = 0;
        const dormDetailsPanel = card.querySelector('.dorm-details-panel');
        const dormFeeDailyInput = card.querySelector('.dorm-fee-daily');
        const dormFeeDaily = parseFloat(dormFeeDailyInput.value) || 0;

        if (dormDetailsPanel.classList.contains('is-visible') && dormFeeDaily > 0) {
            const dormDays = parseInt(card.querySelector('.dorm-days-selector').value, 10) || 1;
            dormFee = (dormFeeDaily / dormDays) * 30;
        } else {
            dormFee = parseFloat(card.querySelector('.dorm-fee-monthly').value) || 0;
        }

        // --- Food Cost Calculation ---
        let foodCost = 0;
        const foodDetailsPanel = card.querySelector('.food-details-panel');
        const foodCostDailyInput = card.querySelector('.food-cost-daily');
        const foodCostDaily = parseFloat(foodCostDailyInput.value) || 0;

        if (foodDetailsPanel.classList.contains('is-visible') && foodCostDaily > 0) {
            const foodUnitValue = parseFloat(card.querySelector('.food-unit-value').value) || 1;
            const foodUnit = card.querySelector('.unit-option.active').dataset.unit; // Get active unit from data-unit
            if (foodUnit === '日') {
                foodCost = (foodCostDaily / foodUnitValue) * 30;
            } else { // foodUnit === '回'
                foodCost = foodCostDaily * foodUnitValue;
            }
        } else {
            foodCost = parseFloat(card.querySelector('.food-cost-monthly').value) || 0;
        }

        // --- Final Calculation ---
        const monthlyIncome = hourlyWage * 8 * 22;
        const totalDeductions = dormFee + utilitiesFee + foodCost + transportDeduction;
        const netMonthlyIncome = monthlyIncome - totalDeductions;
        const effectiveHourlyWage = netMonthlyIncome > 0 ? netMonthlyIncome / 8 / 22 : 0;

        card.querySelector('.monthly-income').textContent = Math.round(monthlyIncome);
        card.querySelector('.effective-hourly-wage').textContent = Math.round(effectiveHourlyWage);
        card.querySelector('.transport-cost').textContent = Math.round(transportDisplay);
    }

    function updateMapButtonState(card) {
        const mapBtn = card.querySelector('.map-btn');
        const destination = card.querySelector('.job-title').value;
        const origin = departureInput.value;

        // Reset button to default state before checking
        mapBtn.classList.remove('error', 'ready');
        mapBtn.textContent = 'ルートと料金を確認';

        if (origin && destination) {
            mapBtn.classList.add('ready');
        } 
    }

    function sortCards() {
        const cards = Array.from(jobCardsContainer.querySelectorAll('.job-card'));
        
        cards.sort((a, b) => {
            const wageA = parseFloat(a.querySelector('.effective-hourly-wage').textContent) || 0;
            const wageB = parseFloat(b.querySelector('.effective-hourly-wage').textContent) || 0;
            return wageB - wageA;
        });

        jobCardsContainer.innerHTML = '';
        cards.forEach(card => jobCardsContainer.appendChild(card));
    }

    // --- Dynamic Ad Layout ---
    function updateAdLayout() {
        const cardCount = jobCardsContainer.children.length;
        const screenWidth = window.innerWidth;

        if (screenWidth >= 1200 && cardCount < 3) {
            mainElement.classList.add('side-ad-layout');
        } else {
            mainElement.classList.remove('side-ad-layout');
        }
    }

    // Watch for cards being added or removed
    const observer = new MutationObserver(updateAdLayout);
    observer.observe(jobCardsContainer, { childList: true });

    // Update layout on window resize
    window.addEventListener('resize', updateAdLayout);

    // --- Initial Load ---
    addJobCard();
});
