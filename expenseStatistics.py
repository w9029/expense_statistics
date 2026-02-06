import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib as mpl
import time
import platform
from datetime import datetime, timedelta
import calendar

'''
消费种类：
不计入：转移，取钱等
额外支出：本应该避免的支出
固定支出：定期需要支付的钱（水电费等）
零食
日用品
水果
一次性必要支出：家具等
饮料
娱乐
早餐
正
'''

def get_current_and_previous_month_dates():
    # 获取当前日期
    current_date = datetime.now()

    # 计算上个月的这一天
    # 如果当前月份是1月，则上个月是前一年的12月
    if current_date.month == 1:
        previous_month = 12
        previous_year = current_date.year - 1
    else:
        previous_month = current_date.month - 1
        previous_year = current_date.year

    # 获取上个月的天数
    _, last_day_of_previous_month = calendar.monthrange(previous_year, previous_month)

    # 使用min函数来处理当前日期是本月最后一天的情况
    previous_month_day = min(current_date.day, last_day_of_previous_month)
    previous_month_date = datetime(previous_year, previous_month, previous_month_day)

    # 将上个月的日期往后加一天
    previous_month_date = previous_month_date + timedelta(days=1)

    return current_date, previous_month_date

end, start = get_current_and_previous_month_dates()

# start = pd.to_datetime('2025-8-20').to_pydatetime()
# end = pd.to_datetime('2025-8-1').to_pydatetime()
   
print(start, "to", end)

MAC_MODE = 0
SYS_TYPE = platform.system()
if SYS_TYPE != "Windows":
    MAC_MODE = 1

df = None
if MAC_MODE == 1:
    df = pd.read_excel('/Users/wangjiahua/Library/CloudStorage/OneDrive-'
                       'HiroshimaUniversity/记账.xlsx')
else:
    df = pd.read_excel('F:\\OneDrive\\记账.xlsx')

endIndex = df.index[-1]

EXCHANGE_RATE = 0.0500
SUPERMARKET_TAX_RATE = 0.1

onlyRmbTotal = 0.0
onlyJpyTotal = 0.0

TotalJpy = 0.0

# print(pd.isnull(df['学生证'][165]))

expenseTypes = {}

marketFlag = 0
count = 0
for i in range(endIndex+1):
    # 筛选时间
    #print(type(df['日期'][i].to_pydatetime()))
    # print(df['日期'][i])

    # 如果不是最后一行，且当前行有日期，且下一行日期为空，当前行为合并消费类数据，
    # 需要做标记, 记录当前日期
    if i < endIndex and not pd.isnull(df['日期'][i]) and pd.isnull(df['日期'][i+1]):
        marketFlag = 1
        curDate = df['日期'][i].to_pydatetime()
    # 如果不是第一行，且当前有日期，且上一行没日期，判定为合并消费记录结束，标记归零
    elif i > 0 and not pd.isnull(df['日期'][i]) and pd.isnull(df['日期'][i-1]):
        marketFlag = 0
        curDate = None


    # 获取当前日期回溯一个月的账单


    # 如果是普通记录，用当前记录的日期判断，如果是合并消费记录，则直接用curDate
    if marketFlag == 0:
        curDate = df['日期'][i].to_pydatetime()

    if not start <= curDate <= end:
        continue
    count += 1
    # print(df['日期'][i])

    # 不计入处理
    if df['消费种类'][i] == '不计入':
        continue

    goodsName = df['消费名称'][i]

    # if(df['消费种类'][i] == " "):
    #     print("Got {}".format(goodsName))

    # 合并消费商品账单处理  只计入类别统计，不算总金额统计  注意：合并消费账单商品价格没算税
    if pd.isnull(df['日期'][i]) or df['日期'][i] == "" or df['日期'][i] is None:
        # 消费分类
        if df['消费种类'][i] not in expenseTypes.keys():
            expenseTypes.update({df['消费种类'][i]: 0.0})

        # 如果非"含税合并消费"，则需要加税
        if df['消费名称'][i] == "含税合并消费":
            curJpyPrice = df['消费数额'][i]
        else:
            curJpyPrice = df['消费数额'][i] * (1 + SUPERMARKET_TAX_RATE)

        # TODO bug，合并消费如果是人民币的话会出错
        if df['币种'][i] == '人民币':
            curJpyPrice = df['消费数额'][i] / EXCHANGE_RATE
        else:
            curJpyPrice = curJpyPrice
        expenseTypes[df['消费种类'][i]] += curJpyPrice

        # 合并消费总账单已经计算过，所以单品不需要再进行后续处理
        continue

    # 其他处理  总金额统计
    curJpyPrice = 0
    if(df['币种'][i] == '人民币'):
        onlyRmbTotal += df['消费数额'][i]
        curJpyPrice = df['消费数额'][i] / EXCHANGE_RATE
    else:
        # TODO 合并消费商品rmb计算有错误
        onlyJpyTotal += df['消费数额'][i]
        curJpyPrice = df['消费数额'][i]
    TotalJpy += curJpyPrice

    # 消费分类
    if df['消费种类'][i] not in expenseTypes.keys() and not pd.isnull(df['消费种类'][i]):
        expenseTypes.update({df['消费种类'][i]: 0.0})
    # 合并消费购物的分类已经计算过
    if not pd.isnull(df['消费种类'][i]):
        expenseTypes[df['消费种类'][i]] += curJpyPrice

    # sumTypes = sum(expenseTypes.values())

# 把dict里所有浮点数都保留两位小数
def round_floats_in_dict(obj):
    if isinstance(obj, float):
        return round(obj, 2)
    elif isinstance(obj, dict):
        return {k: round_floats_in_dict(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [round_floats_in_dict(item) for item in obj]
    else:
        return obj

print("总消费：{}".format(TotalJpy))
print("rmb消费：{}".format(onlyRmbTotal))
print("jpy消费：{}".format(onlyJpyTotal))
print("类型统合：{} \n ***********************".format(sum(expenseTypes.values())))

# print(expenseTypes)
rounded_data = round_floats_in_dict(expenseTypes)
print(rounded_data)
# for key in rounded_data.keys():
#     print ("{}: {}".format(key, rounded_data[key]))

from matplotlib.font_manager import FontProperties  # 导入FontProperties

# font = FontProperties(fname="SimHei.ttf", size=14)  # 设置字体

if MAC_MODE == 1:
    plt.rcParams['font.sans-serif'] = ['Arial unicode ms']
else:
    plt.rcParams['font.sans-serif'] = ['SimHei']
plt.pie(expenseTypes.values(), labels=expenseTypes.keys(), autopct="%1.1f%%")

# print(count)
plt.show()


