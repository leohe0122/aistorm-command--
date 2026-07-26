#!/usr/bin/env python3
"""
预处理 t100-command-data-export.sql，修复所有 JSON 字段格式问题：
1. clients.monitorKeywords: 逗号分隔字符串 → JSON数组
2. meddpicc_snapshots.scores: '[object Object]' → 有效JSON对象
3. arsenal_weapons.tags: 逗号分隔字符串 → JSON数组
4. opportunity_scores.warnings: 检查并修复
"""
import re
import json
import sys

input_file = sys.argv[1] if len(sys.argv) > 1 else '/home/ubuntu/upload/t100-command-data-export.sql'
output_file = sys.argv[2] if len(sys.argv) > 2 else '/home/ubuntu/upload/t100-command-data-fixed.sql'

with open(input_file, 'r', encoding='utf-8') as f:
    content = f.read()

# ── Fix 1: clients.monitorKeywords ──────────────────────────────────────────
# Pattern: comma-separated string like '美的,Midea,OT安全'
# Need to convert to JSON array like '["美的","Midea","OT安全"]'
def fix_monitor_keywords(match):
    """Convert comma-separated string to JSON array in monitorKeywords column."""
    full = match.group(0)
    # The monitorKeywords value is the 10th column (0-indexed: 9)
    # We need to parse the VALUES rows carefully
    return full  # Will handle per-row below

def csv_to_json_array(val):
    """Convert 'a,b,c' to '["a","b","c"]'"""
    if val.startswith('[') or val == 'NULL':
        return val  # Already JSON or NULL
    parts = [p.strip() for p in val.split(',') if p.strip()]
    return json.dumps(parts, ensure_ascii=False)

# Fix clients monitorKeywords - it's column index 9 (0-based) in the INSERT
# INSERT INTO `clients` (`id`, `name`, `nameEn`, `industry`, `stage`, `priority`, 
#   `hookTopic`, `securityAngle`, `notes`, `monitorKeywords`, `createdAt`, `updatedAt`, `isTest`, `plannedFirstVisitDate`)
# monitorKeywords is at position 9

# Fix arsenal_weapons tags - column index 4
# INSERT INTO `arsenal_weapons` (`id`, `category`, `title`, `subtitle`, `tags`, ...)
# tags is at position 4

# Fix meddpicc_snapshots scores - replace '[object Object]' with valid JSON
# Default MEDDPICC snapshot scores
default_scores = json.dumps({
    "metricsScore": 0, "economicBuyerScore": 0, "decisionCriteriaScore": 0,
    "decisionProcessScore": 0, "paperProcessScore": 0, "implicatePainScore": 0,
    "championScore": 0, "competitionScore": 0, "totalScore": 0
}, ensure_ascii=False)

content = content.replace("'[object Object]'", f"'{default_scores}'")
print("Fixed [object Object] in meddpicc_snapshots")

# Fix opportunity_scores.warnings - check if it's a valid JSON string
# The warnings field should be a JSON array like '["warning1","warning2"]'
# Let's check what format it's in
opp_scores_m = re.search(r'INSERT INTO `opportunity_scores`[^;]+;', content, re.DOTALL)
if opp_scores_m:
    block = opp_scores_m.group(0)
    # Find warnings values - they appear as the 8th value in each row
    # Check if any warnings look like non-JSON
    warnings_pattern = re.findall(r"'(风险[^']*)'", block)
    if warnings_pattern:
        print(f"Found {len(warnings_pattern)} non-JSON warnings values - these need fixing")
        # The warnings field contains plain text, not JSON arrays
        # Need to wrap them in JSON arrays
        # Pattern: find each row and fix the warnings column
        # warnings is column 8 (0-based) in opportunity_scores

# Parse and fix rows with a more targeted approach
# For clients: fix monitorKeywords (col 9)
def fix_clients_insert(content):
    pattern = r"(INSERT INTO `clients`[^V]*VALUES\n)((?:  \([^;]+\)[,;]\n?)+)"
    m = re.search(pattern, content, re.DOTALL)
    if not m:
        print("WARNING: Could not find clients INSERT block")
        return content
    
    header = m.group(1)
    rows_block = m.group(2)
    
    # We need to parse each row and fix the monitorKeywords (col 9)
    # monitorKeywords col: id(0) name(1) nameEn(2) industry(3) stage(4) priority(5) 
    #                      hookTopic(6) securityAngle(7) notes(8) monitorKeywords(9) ...
    # The value is a plain string like '美的,Midea,OT安全'
    # We need to convert it to a JSON array
    
    # Simple approach: find the pattern where monitorKeywords is a non-JSON string
    # It appears as: '...', '2026-... (followed by a timestamp)
    # Pattern: single-quoted string before a timestamp that contains no [ or {
    
    def fix_row(row):
        # Find monitorKeywords value: it's between the 9th and 10th commas at the top level
        # Simple heuristic: find '...' patterns that look like CSV keywords
        # The monitorKeywords is followed by a timestamp like '2026-'
        # Pattern: 'keywords_value', '2026-
        fixed = re.sub(
            r"'([^']*(?:,)[^']*)', '20\d\d-",  # CSV string followed by timestamp
            lambda m2: f"'{csv_to_json_array(m2.group(1))}', '20{m2.group(0)[len(m2.group(1))+3:]}",
            row
        )
        return fixed
    
    # Actually, let's use a simpler targeted replacement
    # monitorKeywords values are plain CSV strings like '美的,Midea,泰国工厂,工业AI,OT安全,张小懿'
    # They appear right before the createdAt timestamp
    # Replace pattern: '非JSON字符串', '2026- with '["非","JSON","字符串"]', '2026-
    
    fixed_rows = re.sub(
        r"'([^'\[\{][^']*,[^']*)', '(20\d\d-\d\d-\d\d)",
        lambda m2: f"'{csv_to_json_array(m2.group(1))}', '{m2.group(2)}",
        rows_block
    )
    
    new_block = header + fixed_rows
    return content[:m.start()] + new_block + content[m.end():]

content = fix_clients_insert(content)
print("Fixed clients.monitorKeywords")

# Fix arsenal_weapons.tags - same approach
def fix_arsenal_weapons_insert(content):
    m = re.search(r"(INSERT INTO `arsenal_weapons`[^V]*VALUES\n)((?:  \([^;]+\)[,;]\n?)+)", content, re.DOTALL)
    if not m:
        print("WARNING: Could not find arsenal_weapons INSERT block")
        return content
    
    rows_block = m.group(2)
    # tags is col 4: id(0) category(1) title(2) subtitle(3) tags(4) description(5)...
    # tags value is a plain CSV string like 'AI安全,智能体安全,企业合规,大模型'
    # It appears after subtitle (which is a long string) and before description
    # Simple: replace non-JSON strings that look like CSV tags
    fixed_rows = re.sub(
        r"'([^'\[\{][^']*,[^']*)', '(?:[^']*(?:面向|适用|针对|提供|帮助|用于|支持))",
        lambda m2: f"'{csv_to_json_array(m2.group(1))}', '{m2.group(0)[len(m2.group(1))+3:]}",
        rows_block
    )
    
    new_content = content[:m.start(2)] + fixed_rows + content[m.end(2):]
    return new_content

content = fix_arsenal_weapons_insert(content)
print("Fixed arsenal_weapons.tags")

# Fix opportunity_scores.warnings - convert plain text to JSON array
def fix_opportunity_scores_warnings(content):
    m = re.search(r"(INSERT INTO `opportunity_scores`[^V]*VALUES\n)((?:  \([^;]+\)[,;]\n?)+)", content, re.DOTALL)
    if not m:
        return content
    
    rows_block = m.group(2)
    # warnings is the 8th column (0-based): id(0) clientId(1) overallScore(2) meddpiccScore(3) 
    # signalScore(4) riskLevel(5) aiAnalysis(6) warnings(7) createdAt(8) visitFrequencyScore(9)
    # warnings value: '风险1...' plain text → needs to be JSON array
    
    # Replace non-JSON warnings values with JSON arrays
    fixed = re.sub(
        r"'(风险[^']+)'",
        lambda m2: "'" + json.dumps([m2.group(1)], ensure_ascii=False) + "'",
        rows_block
    )
    
    return content[:m.start(2)] + fixed + content[m.end(2):]

content = fix_opportunity_scores_warnings(content)
print("Fixed opportunity_scores.warnings")

with open(output_file, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nFixed SQL written to: {output_file}")
