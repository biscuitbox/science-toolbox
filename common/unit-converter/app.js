const domains = {
    basic: {
        categories: {
            length: { name: '길이' },
            area: { name: '넓이' },
            volume: { name: '부피' },
            mass: { name: '질량' },
            time: { name: '시간' },
            temperature: { name: '온도' },
            density: { name: '밀도' }
        }
    },
    physics: {
        categories: {
            speed: { name: '속도' },
            acceleration: { name: '가속도' },
            force: { name: '힘' },
            pressure: { name: '압력' },
            energy: { name: '에너지' },
            power: { name: '전력' },
            electric_charge: { name: '전하량' },
            current: { name: '전류' },
            voltage: { name: '전압' },
            resistance: { name: '저항' },
            wave: { name: '진동수' },
            wavelength: { name: '파장' }
        }
    },
    chemistry: {
        categories: {
            mole: { name: 'mol' },
            molarity: { name: '몰농도' },
            mass_concentration: { name: '질량농도' },
            gas_pressure: { name: '기체 압력' },
            temperature: { name: '온도' }
        }
    },
    biology: {
        categories: {
            cell_size: { name: '세포 크기' },
            solution_volume: { name: '용액 부피' },
            concentration: { name: '농도' },
            bio_mass: { name: '질량' }
        }
    },
    earth: {
        categories: {
            atm_pressure: { name: '기압' },
            astronomy_dist: { name: '천문 거리' },
            cosmic_speed: { name: '지구·우주 속도' },
            angle: { name: '각도' }
        }
    }
};

// name, factor (to base unit)
// 같은 범주 안에서만 변환됩니다. 예: 길이↔길이, 압력↔압력.
// ⚠️ 농도(%, ppm 등)는 고등학교 수준의 희석 수용액/무차원 비율 변환용입니다.
const unitsData = {
    // === Basic ===
    length: {
        'm': { name: '미터 (m)', factor: 1 },
        'km': { name: '킬로미터 (km)', factor: 1000 },
        'cm': { name: '센티미터 (cm)', factor: 0.01 },
        'mm': { name: '밀리미터 (mm)', factor: 0.001 },
        'um': { name: '마이크로미터 (µm)', factor: 0.000001 },
        'nm': { name: '나노미터 (nm)', factor: 0.000000001 },
        'pm': { name: '피코미터 (pm)', factor: 1e-12 },
        'in': { name: '인치 (in)', factor: 0.0254 },
        'ft': { name: '피트 (ft)', factor: 0.3048 },
        'yd': { name: '야드 (yd)', factor: 0.9144 },
        'mi': { name: '마일 (mi)', factor: 1609.344 }
    },
    area: {
        'm2': { name: '제곱미터 (m²)', factor: 1 },
        'km2': { name: '제곱킬로미터 (km²)', factor: 1000000 },
        'cm2': { name: '제곱센티미터 (cm²)', factor: 0.0001 },
        'mm2': { name: '제곱밀리미터 (mm²)', factor: 0.000001 },
        'ha': { name: '헥타르 (ha)', factor: 10000 },
        'ac': { name: '에이커 (ac)', factor: 4046.8564224 },
        'pyeong': { name: '평', factor: 3.305785 }
    },
    volume: {
        'L': { name: '리터 (L)', factor: 1 },
        'mL': { name: '밀리리터 (mL)', factor: 0.001 },
        'uL': { name: '마이크로리터 (µL)', factor: 0.000001 },
        'nL': { name: '나노리터 (nL)', factor: 0.000000001 },
        'cm3': { name: '세제곱센티미터 (cm³, cc)', factor: 0.001 },
        'dm3': { name: '세제곱데시미터 (dm³)', factor: 1 },
        'm3': { name: '세제곱미터 (m³)', factor: 1000 },
        'gal_us': { name: '미국 갤런 (US gal)', factor: 3.785411784 },
        'fl_oz_us': { name: '미국 액량 온스 (US fl oz)', factor: 0.0295735295625 }
    },
    mass: {
        'kg': { name: '킬로그램 (kg)', factor: 1 },
        'g': { name: '그램 (g)', factor: 0.001 },
        'mg': { name: '밀리그램 (mg)', factor: 0.000001 },
        'ug': { name: '마이크로그램 (µg)', factor: 1e-9 },
        'ng': { name: '나노그램 (ng)', factor: 1e-12 },
        't': { name: '톤 (t)', factor: 1000 },
        'lb': { name: '파운드 (lb)', factor: 0.45359237 },
        'oz': { name: '온스 (oz)', factor: 0.028349523125 }
    },
    time: {
        's': { name: '초 (s)', factor: 1 },
        'ms': { name: '밀리초 (ms)', factor: 0.001 },
        'us': { name: '마이크로초 (µs)', factor: 0.000001 },
        'ns': { name: '나노초 (ns)', factor: 0.000000001 },
        'min': { name: '분 (min)', factor: 60 },
        'h': { name: '시간 (h)', factor: 3600 },
        'day': { name: '일 (day)', factor: 86400 },
        'year': { name: '년 (365일 기준)', factor: 31536000 }
    },
    temperature: {
        'celsius': { name: '섭씨 (°C)' },
        'fahrenheit': { name: '화씨 (°F)' },
        'kelvin': { name: '켈빈 (K)' }
    },
    density: {
        'kg_m3': { name: 'kg/m³', factor: 1 },
        'g_L': { name: 'g/L', factor: 1 },
        'mg_mL': { name: 'mg/mL', factor: 1 },
        'g_mL': { name: 'g/mL', factor: 1000 },
        'g_cm3': { name: 'g/cm³', factor: 1000 },
        'kg_L': { name: 'kg/L', factor: 1000 }
    },

    // === Physics ===
    speed: {
        'm_s': { name: 'm/s', factor: 1 },
        'km_h': { name: 'km/h', factor: 1/3.6 },
        'cm_s': { name: 'cm/s', factor: 0.01 },
        'km_s': { name: 'km/s', factor: 1000 },
        'knot': { name: '노트 (knot)', factor: 0.514444 },
        'mach': { name: '마하 1 ≈ 340.3 m/s, 15℃ 공기 기준', factor: 340.3 }
    },
    acceleration: {
        'm_s2': { name: 'm/s²', factor: 1 },
        'cm_s2': { name: 'cm/s²', factor: 0.01 },
        'gal': { name: 'Gal (cm/s²)', factor: 0.01 },
        'g': { name: '중력가속도 (g)', factor: 9.80665 }
    },
    force: {
        'N': { name: '뉴턴 (N)', factor: 1 },
        'dyn': { name: '다인 (dyn)', factor: 0.00001 },
        'kgf': { name: '킬로그램힘 (kgf)', factor: 9.80665 },
        'lbf': { name: '파운드힘 (lbf)', factor: 4.4482216152605 }
    },
    pressure: {
        'Pa': { name: '파스칼 (Pa)', factor: 1 },
        'hPa': { name: '헥토파스칼 (hPa)', factor: 100 },
        'kPa': { name: '킬로파스칼 (kPa)', factor: 1000 },
        'MPa': { name: '메가파스칼 (MPa)', factor: 1000000 },
        'bar': { name: '바 (bar)', factor: 100000 },
        'atm': { name: '기압 (atm)', factor: 101325 },
        'torr': { name: '토르 (Torr)', factor: 101325 / 760 },
        'mmHg': { name: '밀리미터수은 (mmHg)', factor: 101325 / 760 },
        'psi': { name: 'psi', factor: 6894.757293168 }
    },
    energy: {
        'J': { name: '줄 (J)', factor: 1 },
        'kJ': { name: '킬로줄 (kJ)', factor: 1000 },
        'cal': { name: '칼로리 (cal, 열화학)', factor: 4.184 },
        'kcal': { name: '킬로칼로리 (kcal)', factor: 4184 },
        'eV': { name: '전자볼트 (eV)', factor: 1.602176634e-19 },
        'Wh': { name: '와트시 (Wh)', factor: 3600 },
        'kWh': { name: '킬로와트시 (kWh)', factor: 3600000 }
    },
    power: {
        'W': { name: '와트 (W)', factor: 1 },
        'kW': { name: '킬로와트 (kW)', factor: 1000 },
        'MW': { name: '메가와트 (MW)', factor: 1000000 },
        'hp': { name: '마력 (mechanical hp)', factor: 745.699872 }
    },
    electric_charge: {
        'C': { name: '쿨롱 (C)', factor: 1 },
        'mC': { name: '밀리쿨롱 (mC)', factor: 0.001 },
        'uC': { name: '마이크로쿨롱 (µC)', factor: 0.000001 },
        'Ah': { name: '암페어시 (Ah)', factor: 3600 },
        'mAh': { name: '밀리암페어시 (mAh)', factor: 3.6 }
    },
    current: {
        'A': { name: '암페어 (A)', factor: 1 },
        'mA': { name: '밀리암페어 (mA)', factor: 0.001 },
        'uA': { name: '마이크로암페어 (µA)', factor: 0.000001 }
    },
    voltage: {
        'V': { name: '볼트 (V)', factor: 1 },
        'mV': { name: '밀리볼트 (mV)', factor: 0.001 },
        'kV': { name: '킬로볼트 (kV)', factor: 1000 }
    },
    resistance: {
        'ohm': { name: '옴 (Ω)', factor: 1 },
        'kohm': { name: '킬로옴 (kΩ)', factor: 1000 },
        'Mohm': { name: '메가옴 (MΩ)', factor: 1000000 }
    },
    wave: {
        'Hz': { name: '헤르츠 (Hz)', factor: 1 },
        'kHz': { name: '킬로헤르츠 (kHz)', factor: 1000 },
        'MHz': { name: '메가헤르츠 (MHz)', factor: 1000000 },
        'GHz': { name: '기가헤르츠 (GHz)', factor: 1000000000 },
        'rpm': { name: 'RPM', factor: 1/60 }
    },
    wavelength: {
        'm': { name: '미터 (m)', factor: 1 },
        'cm': { name: '센티미터 (cm)', factor: 0.01 },
        'mm': { name: '밀리미터 (mm)', factor: 0.001 },
        'um': { name: '마이크로미터 (µm)', factor: 0.000001 },
        'nm': { name: '나노미터 (nm)', factor: 0.000000001 },
        'pm': { name: '피코미터 (pm)', factor: 1e-12 }
    },

    // === Chemistry ===
    mole: {
        'mol': { name: '몰 (mol)', factor: 1 },
        'mmol': { name: '밀리몰 (mmol)', factor: 0.001 },
        'umol': { name: '마이크로몰 (µmol)', factor: 0.000001 }
    },
    molarity: {
        'M': { name: '몰농도 (M, mol/L)', factor: 1 },
        'mM': { name: '밀리몰농도 (mM)', factor: 0.001 },
        'uM': { name: '마이크로몰농도 (µM)', factor: 0.000001 },
        'nM': { name: '나노몰농도 (nM)', factor: 0.000000001 },
        'mol_m3': { name: 'mol/m³', factor: 0.001 }
    },
    mass_concentration: {
        'g_L': { name: 'g/L', factor: 1 },
        'mg_L': { name: 'mg/L', factor: 0.001 },
        'ug_L': { name: 'µg/L', factor: 0.000001 },
        'mg_mL': { name: 'mg/mL', factor: 1 },
        'g_mL': { name: 'g/mL', factor: 1000 },
        'mg_dL': { name: 'mg/dL', factor: 0.01 }
    },
    gas_pressure: {
        'atm': { name: '기압 (atm)', factor: 1 },
        'torr': { name: '토르 (Torr)', factor: 1/760 },
        'mmHg': { name: 'mmHg', factor: 1/760 },
        'Pa': { name: 'Pa', factor: 1/101325 },
        'hPa': { name: 'hPa', factor: 100/101325 },
        'kPa': { name: 'kPa', factor: 1000/101325 },
        'bar': { name: 'bar', factor: 100000/101325 }
    },

    // === Biology ===
    cell_size: {
        'um': { name: '마이크로미터 (µm)', factor: 1 },
        'nm': { name: '나노미터 (nm)', factor: 0.001 },
        'pm': { name: '피코미터 (pm)', factor: 0.000001 },
        'mm': { name: '밀리미터 (mm)', factor: 1000 }
    },
    solution_volume: {
        'mL': { name: '밀리리터 (mL)', factor: 1 },
        'uL': { name: '마이크로리터 (µL)', factor: 0.001 },
        'nL': { name: '나노리터 (nL)', factor: 0.000001 },
        'L': { name: '리터 (L)', factor: 1000 },
        'cm3': { name: '세제곱센티미터 (cm³, cc)', factor: 1 }
    },
    concentration: {
        'percent': { name: '퍼센트 (%)', factor: 1 },
        'permille': { name: '퍼밀 (‰)', factor: 0.1 },
        'ppm': { name: 'ppm', factor: 0.0001 },
        'ppb': { name: 'ppb', factor: 0.0000001 }
    },
    bio_mass: {
        'mg': { name: '밀리그램 (mg)', factor: 1 },
        'ug': { name: '마이크로그램 (µg)', factor: 0.001 },
        'ng': { name: '나노그램 (ng)', factor: 0.000001 },
        'pg': { name: '피코그램 (pg)', factor: 0.000000001 },
        'g': { name: '그램 (g)', factor: 1000 }
    },

    // === Earth Science ===
    atm_pressure: {
        'hPa': { name: '헥토파스칼 (hPa)', factor: 1 },
        'mb': { name: '밀리바 (mb)', factor: 1 },
        'Pa': { name: '파스칼 (Pa)', factor: 0.01 },
        'kPa': { name: '킬로파스칼 (kPa)', factor: 10 },
        'atm': { name: '기압 (atm)', factor: 1013.25 },
        'mmHg': { name: '밀리미터수은 (mmHg)', factor: 1013.25 / 760 }
    },
    astronomy_dist: {
        'ly': { name: '광년 (ly)', factor: 1 },
        'pc': { name: '파섹 (pc)', factor: 3.261563777 },
        'AU': { name: '천문단위 (AU)', factor: 0.0000158125074098 },
        'km': { name: '킬로미터 (km)', factor: 1.057000834e-13 }
    },
    cosmic_speed: {
        'km_s': { name: 'km/s', factor: 1 },
        'km_h': { name: 'km/h', factor: 1/3600 },
        'm_s': { name: 'm/s', factor: 0.001 },
        'c': { name: '광속 (c)', factor: 299792.458 }
    },
    angle: {
        'degree': { name: '도 (degree, °)', factor: 1 },
        'radian': { name: '라디안 (rad)', factor: 180 / Math.PI },
        'arcmin': { name: '분 (arcmin, \')', factor: 1/60 },
        'arcsec': { name: '초 (arcsec, ")', factor: 1/3600 }
    }
};

const domainSelect = document.getElementById('domainSelect');
const categoryTabs = document.getElementById('categoryTabs');
const inputUnitSelect = document.getElementById('inputUnit');
const outputUnitSelect = document.getElementById('outputUnit');
const inputValueInput = document.getElementById('inputValue');
const outputValueInput = document.getElementById('outputValue');
const formulaText = document.getElementById('formulaText');
const calcProcess = document.getElementById('calcProcess');

let currentDomain = 'basic';
let currentCategory = 'length';

function initDomain() {
    domainSelect.addEventListener('change', (e) => {
        currentDomain = e.target.value;
        const cats = Object.keys(domains[currentDomain].categories);
        currentCategory = cats[0]; // select first tab automatically
        renderTabs();
        populateSelects();
        convert();
    });

    renderTabs();
    populateSelects();
    convert();
}

function renderTabs() {
    categoryTabs.innerHTML = '';
    const cats = domains[currentDomain].categories;
    for (const [key, data] of Object.entries(cats)) {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${key === currentCategory ? 'active' : ''}`;
        btn.textContent = data.name;
        btn.addEventListener('click', () => {
            currentCategory = key;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            populateSelects();
            convert();
        });
        categoryTabs.appendChild(btn);
    }
}

function populateSelects() {
    const cUnits = unitsData[currentCategory];
    inputUnitSelect.innerHTML = '';
    outputUnitSelect.innerHTML = '';

    let isFirst = true;
    let firstUnit = null;
    let secondUnit = null;

    for (const [key, value] of Object.entries(cUnits)) {
        const option1 = document.createElement('option');
        option1.value = key;
        option1.textContent = value.name;
        inputUnitSelect.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = key;
        option2.textContent = value.name;
        outputUnitSelect.appendChild(option2);

        if (isFirst) {
            firstUnit = key;
            isFirst = false;
        } else if (!secondUnit) {
            secondUnit = key;
        }
    }

    inputUnitSelect.value = firstUnit || '';
    outputUnitSelect.value = secondUnit || firstUnit || '';
}

function trimNumberString(str) {
    return str
        .replace(/(\.\d*?[1-9])0+(e|$)/i, '$1$2')
        .replace(/\.0+(e|$)/i, '$1')
        .replace(/e\+?/i, 'e');
}

function formatFloat(num) {
    if (!Number.isFinite(num)) return '';
    if (num === 0) return '0';

    const abs = Math.abs(num);

    // 작은 값과 큰 값은 과학적 표기법으로 표시해 0으로 사라지지 않게 합니다.
    if (abs < 0.000001 || abs >= 1000000000) {
        return trimNumberString(num.toExponential(6));
    }

    return Number(num.toFixed(6)).toString();
}

function formatRatio(num) {
    if (!Number.isFinite(num)) return '';
    if (num === 0) return '0';

    const abs = Math.abs(num);
    if (abs < 0.000001 || abs >= 1000000) {
        return trimNumberString(num.toExponential(6));
    }

    return trimNumberString(num.toPrecision(8)).replace(/\.?0+$/, '');
}

function convert() {
    const val = parseFloat(inputValueInput.value);
    if (isNaN(val)) {
        outputValueInput.value = '';
        formulaText.innerHTML = '';
        calcProcess.innerHTML = '';
        return;
    }

    const fromKey = inputUnitSelect.value;
    const toKey = outputUnitSelect.value;

    let result = 0;
    let fText = '';
    let cProc = '';

    const fromName = unitsData[currentCategory][fromKey].name;
    const toName = unitsData[currentCategory][toKey].name;

    // Special Temperature Handling
    if (currentCategory === 'temperature') {
        let celsius = 0;

        if (fromKey === 'celsius') {
            celsius = val;
            if (toKey === 'celsius') {
                result = val; fText = `동일 단위 변환입니다.`; cProc = `${val} = ${formatFloat(result)}`;
            } else if (toKey === 'fahrenheit') {
                result = (val * 9 / 5) + 32;
                fText = `화씨(°F) = (섭씨(°C) × 9/5) + 32`;
                cProc = `(${val} × 9/5) + 32 = ${formatFloat(result)}`;
            } else if (toKey === 'kelvin') {
                result = val + 273.15;
                fText = `켈빈(K) = 섭씨(°C) + 273.15`;
                cProc = `${val} + 273.15 = ${formatFloat(result)}`;
            }
        } else if (fromKey === 'fahrenheit') {
            celsius = (val - 32) * 5 / 9;
            if (toKey === 'celsius') {
                result = celsius;
                fText = `섭씨(°C) = (화씨(°F) - 32) × 5/9`;
                cProc = `(${val} - 32) × 5/9 = ${formatFloat(result)}`;
            } else if (toKey === 'fahrenheit') {
                result = val; fText = `동일 단위 변환입니다.`; cProc = `${val} = ${formatFloat(result)}`;
            } else if (toKey === 'kelvin') {
                result = celsius + 273.15;
                fText = `켈빈(K) = (화씨(°F) - 32) × 5/9 + 273.15`;
                cProc = `(${val} - 32) × 5/9 + 273.15 = ${formatFloat(result)}`;
            }
        } else if (fromKey === 'kelvin') {
            celsius = val - 273.15;
            if (toKey === 'celsius') {
                result = celsius;
                fText = `섭씨(°C) = 켈빈(K) - 273.15`;
                cProc = `${val} - 273.15 = ${formatFloat(result)}`;
            } else if (toKey === 'fahrenheit') {
                result = (celsius * 9 / 5) + 32;
                fText = `화씨(°F) = (켈빈(K) - 273.15) × 9/5 + 32`;
                cProc = `(${val} - 273.15) × 9/5 + 32 = ${formatFloat(result)}`;
            } else if (toKey === 'kelvin') {
                result = val; fText = `동일 단위 변환입니다.`; cProc = `${val} = ${formatFloat(result)}`;
            }
        }
    } else {
        // Generic factor based conversion
        const factorFrom = unitsData[currentCategory][fromKey].factor;
        const factorTo = unitsData[currentCategory][toKey].factor;
        const ratio = factorFrom / factorTo;
        result = val * ratio;

        const ratioStr = formatRatio(ratio);

        fText = `1 ${fromName} = ${ratioStr} ${toName}`;

        // Educational Special Cases
        if (fromKey === 'km_h' && toKey === 'm_s') {
            fText = `속도 변환 (km/h → m/s)\n1 km = 1000 m, 1 시간(h) = 3600 초(s)\n즉, 1 km/h = 1000 ÷ 3600 m/s`;
            cProc = `${val} × 1000 ÷ 3600 = ${formatFloat(result)}`;
        } else if (fromKey === 'm_s' && toKey === 'km_h') {
            fText = `속도 변환 (m/s → km/h)\n1 m = 1/1000 km, 1 초(s) = 1/3600 시간(h)\n즉, 1 m/s = 3600 ÷ 1000 km/h`;
            cProc = `${val} × 3600 ÷ 1000 = ${formatFloat(result)}`;
        } else if (fromKey === 'kg' && toKey === 'g') {
            fText = `질량 변환 (kg → g)\nkilo(k)는 1000을 의미합니다.`;
            cProc = `${val} × 1000 = ${formatFloat(result)}`;
        } else if (fromKey === 'm' && toKey === 'cm') {
            fText = `길이 변환 (m → cm)\ncenti(c)는 1/100을 의미합니다.`;
            cProc = `${val} × 100 = ${formatFloat(result)}`;
        } else if (fromKey === 'cm' && toKey === 'm') {
            fText = `길이 변환 (cm → m)`;
            cProc = `${val} ÷ 100 = ${formatFloat(result)}`;
        } else if (fromKey === 'm' && toKey === 'nm') {
            fText = `길이 변환 (m → nm)\nnano(n)는 10⁻⁹을 의미합니다.\n즉, 1 m = 1,000,000,000 nm`;
            cProc = `${val} × 1,000,000,000 = ${formatFloat(result)}`;
        } else if (fromKey === 'nm' && toKey === 'm') {
            fText = `길이 변환 (nm → m)\nnano(n)는 10⁻⁹을 의미합니다.`;
            cProc = `${val} × 10⁻⁹ = ${formatFloat(result)}`;
        } else if (fromKey === 'g' && toKey === 'kg') {
            fText = `질량 변환 (g → kg)`;
            cProc = `${val} ÷ 1000 = ${formatFloat(result)}`;
        } else if (fromKey === 'L' && toKey === 'mL') {
            fText = `부피 변환 (L → mL)\nmilli(m)는 10⁻³을 의미합니다.`;
            cProc = `${val} × 1000 = ${formatFloat(result)}`;
        } else if (fromKey === 'mL' && toKey === 'L') {
            fText = `부피 변환 (mL → L)`;
            cProc = `${val} ÷ 1000 = ${formatFloat(result)}`;
        } else if ((fromKey === 'atm' && (toKey === 'mmHg' || toKey === 'torr')) && (currentCategory === 'pressure' || currentCategory === 'gas_pressure')) {
            fText = `압력 변환\n1 atm = 760 mmHg = 760 Torr`;
            cProc = `${val} × 760 = ${formatFloat(result)}`;
        } else if ((fromKey === 'mmHg' || fromKey === 'torr') && toKey === 'atm' && (currentCategory === 'pressure' || currentCategory === 'gas_pressure')) {
            fText = `압력 변환\n760 mmHg = 760 Torr = 1 atm`;
            cProc = `${val} ÷ 760 = ${formatFloat(result)}`;
        } else if (fromKey === 'eV' && toKey === 'J') {
            fText = `에너지 변환\n1 eV = 1.602176634 × 10⁻¹⁹ J`;
            cProc = `${val} × 1.602176634 × 10⁻¹⁹ = ${formatFloat(result)}`;
        } else if (fromKey === 'kWh' && toKey === 'J') {
            fText = `에너지 변환\n1 kWh = 1000 W × 3600 s = 3,600,000 J`;
            cProc = `${val} × 3,600,000 = ${formatFloat(result)}`;
        } else {
            cProc = `${val} × ${ratioStr} = ${formatFloat(result)}`;
        }
    }

    outputValueInput.value = formatFloat(result);
    formulaText.innerHTML = fText.replace(/\n/g, '<br>');
    calcProcess.innerHTML = `<strong>계산식:</strong> ${cProc}`;
}

inputUnitSelect.addEventListener('change', convert);
outputUnitSelect.addEventListener('change', convert);
inputValueInput.addEventListener('input', convert);

// Init
initDomain();
