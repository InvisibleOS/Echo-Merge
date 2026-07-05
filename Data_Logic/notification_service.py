import os
import json
from db_client import DBClient

class NotificationService:
    def __init__(self, db_client: DBClient):
        self.db = db_client
        self.output_dir = os.path.dirname(os.path.abspath(__file__))

    def compile_and_send_mp_digest(self, constituency: str, priorities: list) -> str:
        """Looks up the MP for the constituency, compiles a digest, and saves the draft report."""
        mp = self.db.get_mp(constituency)
        if not mp:
            print(f"⚠️ MP Directory lookup failed for constituency: {constituency}. Addressing to Representative.")
            mp = {
                "mp_name": "Elected Representative",
                "mp_email": f"representative@{constituency.lower().replace(' ', '')}.gov.in",
                "state": "State Government"
            }

        # Select top 3 priority issues
        top_priorities = priorities[:3]
        
        # Build the Markdown report
        digest_md = f"""# ECHOMERGE CITIZEN PRIORITIZATION REPORT

**Date**: July 5, 2026  
**To**: {mp['mp_name']}, Member of Parliament (MP)  
**Constituency**: {constituency}, {mp['state']}  
**Email**: {mp['mp_email']}  
**Subject**: Actionable Priority Digests and Urban Development Solution Plans

Dear {mp['mp_name']},

As part of the Echo-Merge citizen prioritization initiative, we have aggregated and analyzed citizen complaints across your constituency. By fusing citizen demand volume with local public data indicators (including UDISE/Census education gaps and municipal infrastructure indices), we have synthesized the top three priority issues in {constituency}. 

Below are the prioritized issues along with structured, AI-generated solution plans to assist in your development planning.

---

"""

        for idx, item in enumerate(top_priorities):
            sol = item.get("solution_plan", {})
            ward = item.get("hotspot_geo", {}).get("ward", "Constituency")
            
            digest_md += f"""### Priority {idx + 1}: {item['title']}
- **Category**: {item['category']}
- **Resolved Location**: {ward} (Hotspot density: {item['demand_count']} reports)
- **Scoring Priority Index**: {item['demand_score']}/100
- **Summary Action Plan**:

| Attribute | Plan Blueprint |
| :--- | :--- |
| **Responsible Department** | {sol.get('primary_department', 'PWD / Local Municipality')} |
| **Budget Tier Estimate** | {sol.get('estimated_budget_tier', 'Medium')} |
| **Remediation Timeline** | {sol.get('remediation_timeline', '3-6 Months')} |

**Strategic Rationale**:  
{sol.get('strategic_rationale', 'Deploy municipal officers to survey the site and allocate ward-level funds.')}

**Immediate Actions Recommended**:
"""
            for step in sol.get("action_steps", []):
                digest_md += f"1. [ ] {step}\n"
                
            digest_md += "\n---\n\n"

        digest_md += """
### Next Steps
If you or your office would like to proceed with directing these departments, you can trigger these actions directly via the local municipal coordinating officer.

*This report was automatically synthesized and delivered by the Echo-Merge Data Pipeline.*
"""

        # Save the report locally
        filename = f"mp_notification_{constituency.lower().replace(' ', '_')}.md"
        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(digest_md)

        print(f"📧 MP Notification compiled successfully. Notification draft saved to: {filepath}")
        return filepath
