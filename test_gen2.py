import pandas as pd
import random

data = []
provinces = ['广东', '江苏', '浙江', '北京', '上海']
offices = ['华南办事处', '华东办事处', '华东二办', '华北办事处', '上海办事处']
cities = ['广州', '南京', '杭州', '北京', '上海']
products = ['企业级SaaS', '智能硬件', '中台云服务', 'IT运维外包', '咨询与实施', '艾心安', '安达静', '艾速达', '恒沁']
month_names = ['2026年1月', '2026年2月', '2026年3月'] # Provide a few months representing current time

for i in range(200):
    idx = random.randint(0, 4)
    target = random.randint(100000, 500000)
    data.append({
        '所在省区': provinces[idx],
        '所在办事处': offices[idx],
        '省份': provinces[idx],
        '城市': cities[idx],
        '地域标记': '核心区',
        '医院名称': f'测试医院{random.randint(1, 20)}',
        '客户类别': '三甲',
        '产品大类': '心血管类' if products[idx % len(products)] in ['艾心安', '安达静', '艾速达', '恒沁'] else '其它',
        '产品名称': random.choice(products),
        '月份': random.choice(month_names),
        '2026年指标值': target,
        '2026年进货值': int(target * random.uniform(0.5, 1.2)),
        '2026年纯销值': int(target * random.uniform(0.4, 1.0)),
        '2025年进货值': int(target * random.uniform(0.6, 1.1))
    })

df = pd.DataFrame(data)
df.to_excel('test_data_v2.xlsx', index=False)
print("v2 excel ready")
