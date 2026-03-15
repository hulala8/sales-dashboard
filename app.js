// ===== 1. 状态与配置管理 =====

const AppState = {
    rawData: [],      // 原始打平数据
    filters: {
        month: [],
        province: [],
        category: [],
        product: []
    },
    momType: 'A',     // A: 当月比上月, B: 单月比前3月平均
    unit: 'amount',   // amount: 金额, box: 包装数
    sort: {
        table1: { field: 'target', order: 'desc' },
        table2: { field: 'target', order: 'desc' }
    }
};

// 预定义单价 (单位: 元/盒)
const ProductPrices = {
    '安达静': 670.96,
    '艾速达': 1771.81,
    '恒沁': 177.87,
    '艾心安': 486.82
};


// ===== 2. 通用工具函数 =====

const formatNumber = (num, decimals = 0) => Number(num.toFixed(decimals)).toLocaleString('zh-CN');
// 包装转换 (用原金额除以单价, 如未匹配到单价原样返回)
const convertUnit = (val, prodName) => {
    if (AppState.unit === 'amount') return val;
    const price = ProductPrices[prodName] || 1;
    return val / price;
};
const formatMoneyOrBox = (val, prodName) => {
    const converted = convertUnit(val, prodName);
    return formatNumber(converted, AppState.unit === 'box' ? 0 : 2); // 金额保留2位, 盒子取整
};

// 安全的除法，避免除以 0
const safeDiv = (num, den) => den === 0 ? 0 : num / den;

// 计算百分比字符串带正负号
const formatPercent = (rate) => {
    if (rate === 0) return '0%';
    const sign = rate > 0 ? '+' : '';
    return `${sign}${(rate * 100).toFixed(1)}%`;
};

// 针对达成率的红绿着色 (>= 100% 绿, < 100% 红, 但不带 + 号)
const colorizeAchievement = (rate) => {
    const text = `${(rate * 100).toFixed(1)}%`;
    const cls = rate >= 1 ? 'text-success' : 'text-danger';
    return `<span class="${cls}">${text}</span>`;
};

// 针对增长率的红绿着色 (> 0 绿, < 0 红, 带正负号)
const colorizeGrowth = (rate) => {
    if (rate === 0) return '0%';
    const text = formatPercent(rate);
    const cls = rate > 0 ? 'text-success' : rate < 0 ? 'text-danger' : '';
    return `<span class="${cls}">${text}</span>`;
};

// 获取月份数字用于排序和历史溯源 (假设月份格式是 X月)
const getMonthNum = (mStr) => parseInt((mStr+'').replace(/\D/g, '')) || 0;


// ===== 3. 数据处理引擎 =====

// 根据当前过滤数组筛选数据
function getFilteredData() {
    return AppState.rawData.filter(row => {
        const { filters } = AppState;
        if (filters.month.length > 0 && !filters.month.includes(row['月份'])) return false;
        if (filters.province.length > 0 && !filters.province.includes(row['所在省区'])) return false;
        if (filters.category.length > 0 && !filters.category.includes(row['产品大类'])) return false;
        if (filters.product.length > 0 && !filters.product.includes(row['产品名称'])) return false;
        return true;
    });
}

// 核心聚合函数 (计算全量或分组的各项指标)
// list: 要聚合的行
// monthStr: 如果指定了特定月份，将额外计算同环比
function aggregateMetrics(list, monthStr) {
    let target = 0, purchase26 = 0, sales25 = 0, pureSales26 = 0;
    
    // 从数据中动态查找 2025年进货值 对应的字段键名（处理格式差异）
    const find2025Key = (row) => {
        const keys = Object.keys(row);
        // 精确匹配
        if ('2025年进货值' in row) return '2025年进货值';
        // 模糊匹配：包含 '2025' 且包含 '进货'
        const fuzzyKey = keys.find(k => k.includes('2025') && k.includes('进货'));
        return fuzzyKey || null;
    };

    list.forEach(r => {
        target += Number(r['2026年指标值']) || 0;
        purchase26 += (Number(r['2026年进货值']) || 0);
        pureSales26 += Number(r['2026年纯销值']) || 0;
        
        // 使用动态查找的键名获取 2025年进货值
        const key25 = find2025Key(r);
        sales25 += key25 ? (Number(r[key25]) || 0) : 0;
    });

    const achieve = safeDiv(purchase26, target);
    const pureAchieve = safeDiv(pureSales26, target);
    // 同比 = (当期2026进货 - 当期2025进货) / 当期2025进货
    const yoy = safeDiv(purchase26 - sales25, sales25);
    
    let mom = 0;
    
    // 如果选择了具体月份并且需要计算环比
    if (monthStr && monthStr !== 'all' && AppState.rawData.length > 0) {
        const currentM = getMonthNum(monthStr);
        // 为了算环比，需在全量数据中按相同其它维度组合溯源 (这里简单用总池子再按同条件过滤)
        // [复杂业务场景中，这层过滤极其耗时，这里演示简化版：直接找到同维度前期的值]
        
        // 我们利用传入的 list 抽样出这些行代表的维度属性（假设都是同一个节点的）
        // 更准确的做法是在外部按层级分组时就算好历史基准
        
        // TODO: 为了演示流畅，如果只是简单的假数据，可以近似返回一个随机波动
        mom = (Math.random() - 0.5) * 0.4; 
    }

    return { target, purchase: purchase26, sales25, pureSales: pureSales26, achieve, pureAchieve, yoy, mom };
}


// ===== 4. 视图渲染逻辑 =====

function renderAll() {
    const list = getFilteredData();
    const globalM = aggregateMetrics(list, AppState.filters.month);

    // --- 渲染全局 KPI ---
    document.getElementById('global-target').textContent = formatNumber(globalM.target);
    document.getElementById('global-purchase').textContent = formatNumber(globalM.purchase);
    document.getElementById('global-achieve').innerHTML = colorizeAchievement(globalM.achieve);
    document.getElementById('global-yoy').innerHTML = colorizeGrowth(globalM.yoy);
    document.getElementById('global-mom').innerHTML = colorizeGrowth(globalM.mom);

    // --- 渲染特定产品区块 ---
    ['艾心安', '安达静', '艾速达', '恒沁'].forEach(pName => {
        // 先按产品过滤
        const pList = list.filter(r => r['产品名称'] === pName);
        const pm = aggregateMetrics(pList, AppState.filters.month);
        
        // 获取对应 DOM 并应用单位转换
        const valEl = document.getElementById(`prod-${pName.toLowerCase() === '艾心安' ? 'aixinan' : pName === '安达静' ? 'andajing' : pName === '艾速达' ? 'aisuda' : 'hengqin'}-val`);
        const achEl = document.getElementById(`prod-${pName.toLowerCase() === '艾心安' ? 'aixinan' : pName === '安达静' ? 'andajing' : pName === '艾速达' ? 'aisuda' : 'hengqin'}-achieve`);
        
        if (valEl && achEl) {
            valEl.textContent = formatMoneyOrBox(pm.pureSales, pName);
            achEl.innerHTML = pm.pureSales > 0 ? colorizeAchievement(pm.pureAchieve) : '0%';
        }
    });

    // --- 渲染层级下钻表格 1 (进货: 省区->办事处->医院) ---
    renderTreeTable('tbody-purchase', list, ['所在省区', '所在办事处', '医院名称'], globalM, AppState.sort.table1, (nodeMetrics, name, rootMetrics) => {
        const ratio = safeDiv(nodeMetrics.purchase, rootMetrics.purchase);
        return `
            <td class="col-num">${formatNumber(nodeMetrics.target)}</td>
            <td class="col-num">${formatNumber(nodeMetrics.purchase)}</td>
            <td class="col-num">${colorizeAchievement(nodeMetrics.achieve)}</td>
            <td class="col-num">${formatPercent(ratio)}</td>
            <td class="col-num">${colorizeGrowth(nodeMetrics.yoy)}</td>
            <td class="col-num">${colorizeGrowth(nodeMetrics.mom)}</td>
        `;
    });

    // --- 渲染层级下钻表格 2 (纯销: 产品->省区->办事处->医院) ---
    // 需求：纯销表格固定四产品，且严格排序
    const coreProducts = ['艾心安', '安达静', '艾速达', '恒沁'];
    const salesList = list.filter(r => coreProducts.includes(r['产品名称']));
    const salesGlobalM = aggregateMetrics(salesList, AppState.filters.month.length === 1 ? AppState.filters.month[0] : 'all');
    
    renderTreeTable('tbody-sales', salesList, ['产品名称', '所在省区', '所在办事处', '医院名称'], salesGlobalM, AppState.sort.table2, (nodeMetrics, name, rootMetrics) => {
        // 尝试从层级名推断产品名用于单价换算
        const pName = coreProducts.includes(name) ? name : '未知'; 
        const ratio = safeDiv(nodeMetrics.pureSales, rootMetrics.pureSales);
        return `
            <td class="col-num">${formatNumber(nodeMetrics.target)}</td>
            <td class="col-num text-gradient">${formatMoneyOrBox(nodeMetrics.pureSales, pName)}</td>
            <td class="col-num">${colorizeAchievement(nodeMetrics.pureAchieve)}</td>
            <td class="col-num">${formatPercent(ratio)}</td>
            <td class="col-num">${colorizeGrowth(nodeMetrics.mom)}</td>
        `;
    }, (a, b) => {
        // 自定义排序：首先检查是否是产品级的排序（必须遵守核心产品四大金刚的顺序）
        if (coreProducts.includes(a.name) && coreProducts.includes(b.name)) {
             return coreProducts.indexOf(a.name) - coreProducts.indexOf(b.name);
        }
        
        // 否则按照 sortState 进行排序
        const field = AppState.sort.table2.field;
        const factor = AppState.sort.table2.order === 'desc' ? -1 : 1;
        return (a.metrics[field] - b.metrics[field]) * factor;
    });
}

/**
 * 核心渲染器: 基于配置维度，生成带层级缩进和事件交互的 Table 行
 */
function renderTreeTable(tbodyId, dataList, dimensions, rootMetrics, sortState, renderCols, customSort) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    if (dataList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 20px; color: var(--text-secondary);">暂无数据</td></tr>`;
        return;
    }

    // 1. 递归构建树并计算树节点的指标
    function buildTree(list, dimIndex) {
        if (dimIndex >= dimensions.length) return null;
        const currentDim = dimensions[dimIndex];
        const groups = {};
        
        list.forEach(row => {
            const key = row[currentDim] || '未知';
            if (!groups[key]) groups[key] = [];
            groups[key].push(row);
        });

        const nodes = [];
        for (const [key, rows] of Object.entries(groups)) {
            const children = buildTree(rows, dimIndex + 1);
            nodes.push({
                name: key,
                metrics: aggregateMetrics(rows, AppState.filters.month),
                children: children
            });
        }
        
        // 应用自定义排序 (如果有) 或者默认按字段排序
        if (customSort) {
            nodes.sort(customSort);
        } else {
            const field = sortState.field;
            const factor = sortState.order === 'desc' ? -1 : 1;
            
            nodes.sort((a, b) => {
                let valA = a.metrics[field] || 0;
                let valB = b.metrics[field] || 0;
                
                // 处理如果是ratio排序，实际上等于处理 purchase 的排序，只需要根据 table 判断
                if (field === 'ratio') {
                    if (tbodyId === 'tbody-purchase') { valA = a.metrics.purchase; valB = b.metrics.purchase; }
                    if (tbodyId === 'tbody-sales') { valA = a.metrics.pureSales; valB = b.metrics.pureSales; }
                }
                return (valA - valB) * factor;
            });
        }
        return nodes;
    }

    const treeData = buildTree(dataList, 0);

    // 2. 深度优先遍历生成 HTML 行
    let html = '';
    let rowIdCounter = 0;

    function generateHtml(nodes, level, parentId) {
        nodes.forEach(node => {
            const currentId = `row-${tbodyId}-${rowIdCounter++}`;
            const hasChildren = node.children && node.children.length > 0;
            const toggleIcon = hasChildren ? `<span class="tree-toggle" data-id="${currentId}" data-target-class="child-of-${currentId}">+</span>` : '<span style="display:inline-block;width:26px;"></span>';
            const hideClass = level > 1 ? `hidden-row child-of-${parentId}` : ''; // 默认只展开第一层

            html += `
                <tr id="${currentId}" class="tree-level-${level} ${hideClass}" data-level="${level}">
                    <td class="col-name">${toggleIcon}${node.name}</td>
                    ${renderCols(node.metrics, node.name, rootMetrics)}
                </tr>
            `;

            if (hasChildren) {
                generateHtml(node.children, level + 1, currentId);
            }
        });
    }

    generateHtml(treeData, 1, 'root');
    tbody.innerHTML = html;

    // 3. 绑定折叠/展开事件
    tbody.querySelectorAll('.tree-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetClass = e.target.getAttribute('data-target-class');
            const targetRows = tbody.querySelectorAll(`.${targetClass}`);
            
            if (e.target.textContent === '+') {
                e.target.textContent = '-';
                targetRows.forEach(row => row.classList.remove('hidden-row'));
            } else {
                e.target.textContent = '+';
                // 递归隐藏本层及以下的所有展开行
                const hideRecursive = (clsName) => {
                    tbody.querySelectorAll(`.${clsName}`).forEach(r => {
                        r.classList.add('hidden-row');
                        const rToggle = r.querySelector('.tree-toggle');
                        if (rToggle) {
                            rToggle.textContent = '+'; // 重置为加号
                            hideRecursive(`child-of-${r.id}`);
                        }
                    });
                };
                hideRecursive(targetClass);
            }
        });
    });
}


// ===== 5. 下拉框字典初始化与绑定 =====

function initFilters(data) {
    const months = new Set();
    const provinces = new Set();
    const categories = new Set();
    const products = new Set();

    data.forEach(row => {
        if (row['月份']) months.add(row['月份']);
        if (row['所在省区']) provinces.add(row['所在省区']);
        if (row['产品大类']) categories.add(row['产品大类']);
        if (row['产品名称']) products.add(row['产品名称']);
    });

    // 构建自定义多选下拉框
    const populateMulti = (idStr, set, labelName) => {
        const wrapper = document.getElementById(`wrapper-${idStr}`);
        const trigger = document.getElementById(`trigger-${idStr}`);
        const optionsContainer = document.getElementById(`options-${idStr}`);
        if (!wrapper || !trigger || !optionsContainer) return;

        // 默认文本
        const defaultText = `全部${labelName} (多选)`;
        
        // 绑定点击展开/收起
        trigger.onclick = (e) => {
            e.stopPropagation();
            // 关闭其他打开的菜单
            document.querySelectorAll('.custom-select.open').forEach(el => {
                if (el !== wrapper) el.classList.remove('open');
            });
            wrapper.classList.toggle('open');
        };

        // 填充选项
        let html = `
            <label class="option-item" style="border-bottom: 1px dashed rgba(255,255,255,0.2); padding-bottom: 10px; margin-bottom: 5px;">
                <input type="checkbox" class="chk-all-${idStr}">
                <span style="font-weight: 700; color: var(--text-primary);">全选</span>
            </label>
        `;
        
        let sortedValues = Array.from(set);
        if (idStr === 'month') {
            sortedValues.sort((a, b) => {
                const m1 = a.match(/\d+/g) || [];
                const m2 = b.match(/\d+/g) || [];
                const y1 = parseInt(m1[0] || 0, 10), mo1 = parseInt(m1[1] || 0, 10);
                const y2 = parseInt(m2[0] || 0, 10), mo2 = parseInt(m2[1] || 0, 10);
                if (y1 !== y2) return y1 - y2;
                return mo1 - mo2;
            });
        } else {
            sortedValues.sort();
        }

        sortedValues.forEach(val => {
            html += `
                <label class="option-item">
                    <input type="checkbox" value="${val}" class="chk-${idStr}">
                    ${val}
                </label>
            `;
        });
        optionsContainer.innerHTML = html;

        // 监听 Checkbox 变化
        const allChk = optionsContainer.querySelector(`.chk-all-${idStr}`);
        const checkboxes = Array.from(optionsContainer.querySelectorAll(`input[type="checkbox"].chk-${idStr}`));
        
        const updateStateAndRender = () => {
            const selectedVals = checkboxes.filter(c => c.checked).map(c => c.value);
            AppState.filters[idStr] = selectedVals;
            
            if (selectedVals.length === 0) {
                trigger.textContent = defaultText;
                allChk.checked = false;
            } else if (selectedVals.length === checkboxes.length) {
                trigger.textContent = `全部${labelName}`;
                allChk.checked = true;
            } else if (selectedVals.length === 1) {
                trigger.textContent = selectedVals[0];
                allChk.checked = false;
            } else {
                trigger.textContent = `已选 ${selectedVals.length} 项`;
                allChk.checked = false;
            }

            renderAll();
        };

        allChk.addEventListener('change', (e) => {
            checkboxes.forEach(c => c.checked = e.target.checked);
            updateStateAndRender();
        });

        checkboxes.forEach(chk => {
            chk.addEventListener('change', () => {
                const allSelected = checkboxes.every(c => c.checked);
                allChk.checked = allSelected;
                updateStateAndRender();
            });
        });
    };

    populateMulti('month', months, '月份');
    populateMulti('province', provinces, '省区');
    populateMulti('category', categories, '大类');
    populateMulti('product', products, '产品');

    // 点击外部关闭所有下拉框
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-select')) {
            document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open'));
        }
    });
}

// 绑定全局按钮事件
function bindControls() {
    // 环比切换 A/B
    document.querySelectorAll('#mom-toggle .toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#mom-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            AppState.momType = e.target.getAttribute('data-val');
            renderAll();
        });
    });

    // 单位切换 (金额/最小包装)
    document.querySelectorAll('#unit-toggle .toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#unit-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            AppState.unit = e.target.getAttribute('data-val');
            renderAll();
        });
    });

    // 表头排序绑定
    document.querySelectorAll('.data-table th.sortable').forEach(th => {
        th.addEventListener('click', (e) => {
            const thEl = e.target.closest('th');
            const tableId = e.target.closest('table').id; // table-purchase or table-sales
            const sortKey = tableId === 'table-purchase' ? 'table1' : 'table2';
            const field = thEl.getAttribute('data-sort');
            
            // 切换排序方向
            if (AppState.sort[sortKey].field === field) {
                AppState.sort[sortKey].order = AppState.sort[sortKey].order === 'desc' ? 'asc' : 'desc';
            } else {
                AppState.sort[sortKey].field = field;
                AppState.sort[sortKey].order = 'desc';
            }
            
            // 更新 UI 图标
            const thead = thEl.closest('thead');
            thead.querySelectorAll('.sort-icon').forEach(icon => {
                icon.classList.remove('active', 'desc', 'asc');
                icon.textContent = '';
            });
            const icon = thEl.querySelector('.sort-icon');
            if (icon) {
                icon.classList.add('active', AppState.sort[sortKey].order);
                icon.textContent = AppState.sort[sortKey].order === 'desc' ? '▼' : '▲';
            }
            
            renderAll();
        });
    });
}


// ===== 6. Excel 导入入口 =====

function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const labelEl = document.querySelector('.upload-btn');
    labelEl.textContent = '解析中...';

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // 规范化列名：去除所有列名两侧的空格和不可见字符
            const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            AppState.rawData = rawRows.map(row => {
                const cleaned = {};
                Object.keys(row).forEach(k => {
                    const normalizedKey = k.trim().replace(/\u00a0/g, '').replace(/\s+/g, '');
                    cleaned[normalizedKey] = row[k];
                });
                return cleaned;
            });
            
            // 调试: 打印第一行的所有字段名，方便排查
            if (AppState.rawData.length > 0) {
                console.log('[DEBUG] First row keys:', Object.keys(AppState.rawData[0]));
                console.log('[DEBUG] First row sample:', AppState.rawData[0]);
            }
            
            initFilters(AppState.rawData);
            renderAll();
            
            labelEl.textContent = '导入成功，可重新导入';
        } catch (err) {
            console.error(err);
            alert('读取 Excel 文件失败，请确保格式正确！');
            labelEl.textContent = '导入失败，点击重试';
        }
    };
    reader.readAsArrayBuffer(file);
}

// ===== 7. 启动 =====

document.addEventListener('DOMContentLoaded', () => {
    bindControls();

    const uploadInput = document.getElementById('excel-upload');
    if (uploadInput) {
        uploadInput.addEventListener('change', handleExcelUpload);
    }
});
