
import json
import pandas as pd
import numpy as np

with open("statisticsDataBase.json","r") as fd:
    baseData = json.load(fd)

data2 = pd.read_csv("pacs_year_density_table.csv",dtype={
                     'PACS': str,})


data2["normPACS"] = data2["PACS"].apply(lambda x: x.strip().replace(".", ""))
data2["normPACS"] = data2["normPACS"].apply(lambda x: x+"0" if len(x)==1 else x)
existingPACSList = list(data2["normPACS"]);

minYear = 1930
maxYear = 2009
timeseries = data2.loc[:,[str(i) for i in range(minYear,maxYear+1)]].to_numpy()

pacs2timeseries = {existingPACSList[i]:timeseries[i] for i in range(len(existingPACSList))}
baseData["MaxYear"] = maxYear
baseData["MinYear"] = minYear

maxData = np.max(timeseries)
minData = np.min(timeseries)

missing = []
features = []
allPACs = list(baseData["PACSFeatures"].keys())+list()
newPACSFeatures = {}
for pacsCode in allPACs:
    if(pacsCode not in pacs2timeseries):
        missing.append(pacsCode)
        # features = [0.0]*(maxYear-minYear+1)
    else:
        features = list((pacs2timeseries[pacsCode]))
        # features = list((pacs2timeseries[pacsCode]-minData)/(maxData-minData))
        newPACSFeatures[pacsCode] = {"Density":features}

baseData["PACSFeatures"] = newPACSFeatures

with open("statisticsData.json","wt") as fd:
    json.dump(baseData,fd)