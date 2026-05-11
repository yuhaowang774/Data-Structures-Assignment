import 'package:flutter/material.dart';
import 'package:flutter_app/models/station.dart';

class SearchPanel extends StatefulWidget {
  final List<Station> stations;
  final void Function(String start, String end, int mode) onSearch;

  const SearchPanel({
    super.key,
    required this.stations,
    required this.onSearch,
  });

  @override
  State<SearchPanel> createState() => _SearchPanelState();
}

class _SearchPanelState extends State<SearchPanel> {
  final _startController = TextEditingController();
  final _endController = TextEditingController();
  List<Station> _startSuggestions = [];
  List<Station> _endSuggestions = [];

  List<Station> _filter(String input) {
    if (input.isEmpty) return [];
    return widget.stations
        .where((s) => s.name.contains(input))
        .take(8)
        .toList();
  }

  void _onStartChanged(String value) {
    setState(() {
      _startSuggestions = _filter(value.trim());
    });
  }

  void _onEndChanged(String value) {
    setState(() {
      _endSuggestions = _filter(value.trim());
    });
  }

  void _submit(int mode) {
    final start = _startController.text.trim();
    final end = _endController.text.trim();

    if (start.isEmpty || end.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请选择起点站/终点站')),
      );
      return;
    }
    if (start == end) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('起点和终点不能相同')),
      );
      return;
    }
    widget.onSearch(start, end, mode);
  }

  @override
  void dispose() {
    _startController.dispose();
    _endController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildInputWithDropdown(
            label: '起点站',
            controller: _startController,
            suggestions: _startSuggestions,
            onChanged: _onStartChanged,
            onSelect: (station) {
              _startController.text = station.name;
              setState(() => _startSuggestions = []);
            },
          ),
          const SizedBox(height: 12),
          _buildInputWithDropdown(
            label: '终点站',
            controller: _endController,
            suggestions: _endSuggestions,
            onChanged: _onEndChanged,
            onSelect: (station) {
              _endController.text = station.name;
              setState(() => _endSuggestions = []);
            },
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: () => _submit(0),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4A90D9),
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('时间最短'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => _submit(1),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFE67E22),
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('换乘最少'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInputWithDropdown({
    required String label,
    required TextEditingController controller,
    required List<Station> suggestions,
    required void Function(String) onChanged,
    required void Function(Station) onSelect,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, color: Color(0xFF555555))),
        const SizedBox(height: 4),
        TextField(
          controller: controller,
          onChanged: onChanged,
          decoration: InputDecoration(
            hintText: '输入站名',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(4)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            isDense: true,
          ),
        ),
        if (suggestions.isNotEmpty)
          Container(
            constraints: const BoxConstraints(maxHeight: 200),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey),
              borderRadius: BorderRadius.circular(4),
            ),
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: suggestions.length,
              itemBuilder: (context, index) {
                final s = suggestions[index];
                return ListTile(
                  dense: true,
                  title: Text(
                    s.name + (s.isTransfer ? ' (换乘)' : ''),
                    style: const TextStyle(fontSize: 13),
                  ),
                  onTap: () => onSelect(s),
                );
              },
            ),
          ),
      ],
    );
  }
}
