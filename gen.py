import pandas as pd
import random

data = []
provinces = ['广东', '江苏', '浙江', '北京', '上海']
offices = ['华南', '华东', '华东', '华北', '华东']
cities = ['广州', '南京', '杭州', '北京', '上海']
products = ['企业级SaaS', '智能硬件', '中台云服务', 'IT运维外包', '咨询与实施']
months = [f"{i}月" for i in range(1, 13)]

for i in range(100):
    idx = random.randint(0, 4)
    data.append({
        '所在省区': provinces[idx],
        '所在办事处': offices[idx],
        '省份': provinces[idx],
        '城市': cities[idx],
        '地域标记': '核心区',
        '医院名称': f'测试医院{random.randint(1, 10)}',
        '客户类别': '三甲',
        '产品大类': random.choice(products),
        '产品名称': '测试产品',
        '月份': random.choice(months),
        '2026年指标值': random.randint(500000, 1000000),
        '2026年进货值': random.randint(400000, 1200000),
        '2026年纯销值': random.randint(300000, 900000),
        '2025年进货值': random.randint(300000, 1000000)
    })

df = pd.DataFrame(data)
df.to_excel('test_data.xlsx', index=False)
print("Excel file 'test_data.xlsx' created.")
