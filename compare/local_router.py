from metro_router.app import graph_data, run_query


class LocalRouter:
    def __init__(self):
        self.graph_data = graph_data

    def query(self, start_name, end_name, mode=0):
        payload, _ = run_query(start_name, end_name, str(mode))
        return payload

    def get_station_names(self):
        seen = set()
        names = []
        for node in self.graph_data["nodes"]:
            if node["station"] not in seen:
                seen.add(node["station"])
                names.append(node["station"])
        return names

    def get_station_coord(self, name):
        for node in self.graph_data["nodes"]:
            if node["station"] == name:
                return {"lon": node["lon"], "lat": node["lat"]}
        return None
