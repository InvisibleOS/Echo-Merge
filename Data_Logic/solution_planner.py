import os
import json

class SolutionPlanner:
    def __init__(self):
        self.use_vertex = False
        self.project_id = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("ANTIGRAVITY_PROJECT_ID")
        
        if self.project_id and self.project_id != "outside-of-project":
            try:
                import vertexai
                from vertexai.generative_models import GenerativeModel
                vertexai.init(project=self.project_id, location="us-central1")
                self.model = GenerativeModel("gemini-1.5-flash")
                self.use_vertex = True
                print("🤖 Vertex AI Gemini 1.5 model initialized successfully for Solution Planner.")
            except Exception as e:
                print(f"⚠️ Failed to initialize Vertex AI Gemini model ({e}). Using rule-based mock Solution Planner.")
        else:
            print("ℹ️ Google Cloud Project not configured for Gemini. Using rule-based mock Solution Planner.")

    def generate_solution_plan(self, category: str, need_type: str, ward: str, data_gaps: dict, complaints_summary: str) -> dict:
        """Generates a structured solution plan using Gemini 1.5 or rule-based fallback."""
        if self.use_vertex:
            try:
                from vertexai.generative_models import GenerationConfig
                
                prompt = f"""
                You are a senior urban governance advisor to a Member of Parliament (MP) in India.
                We have compiled a prioritized citizen issue with the following details:
                - Category: {category}
                - Issue Type: {need_type}
                - Ward: {ward}
                - Public Data Indicators/Gaps: {json.dumps(data_gaps)}
                - Summary of citizen reports: {complaints_summary}

                Generate a concrete, actionable "Constituency Development Solution Plan" for the MP.
                You must return exactly a JSON object following this JSON Schema:
                {{
                    "primary_department": "Name of the government agency responsible (e.g. BBMP, BWSSB, BESCOM, PWD, NHAI)",
                    "estimated_budget_tier": "Low (under 10L INR) / Medium (10L - 50L INR) / High (above 50L INR)",
                    "remediation_timeline": "Immediate (under 15 Days) / Mid-term (1-3 Months) / Long-term (3-6 Months)",
                    "action_steps": [
                        "Action step 1 (short-term, e.g. immediate inspection/clearance)",
                        "Action step 2 (mid-term, e.g. budget allocation/maintenance)",
                        "Action step 3 (long-term, e.g. policy adjustment/permanent infrastructure build)"
                    ],
                    "strategic_rationale": "One-sentence explanation of why this plan resolves both citizen reports and the public data gap indicators."
                }}
                """
                
                response = self.model.generate_content(
                    prompt,
                    generation_config=GenerationConfig(
                        response_mime_type="application/json",
                        temperature=0.2
                    )
                )
                
                return json.loads(response.text)
            except Exception as e:
                print(f"⚠️ Gemini solution plan generation failed ({e}). Falling back to rule-based generation.")
                
        # Rule-based fallback (extremely realistic)
        category_lower = category.lower()
        if "water" in category_lower or "sanitation" in category_lower:
            return {
                "primary_department": "BWSSB (Bangalore Water Supply and Sewerage Board)",
                "estimated_budget_tier": "High (above 50L INR)" if "drainage" in category_lower else "Medium (10L - 50L INR)",
                "remediation_timeline": "Mid-term (1-3 Months)",
                "action_steps": [
                    "Conduct immediate geo-spatial sensor mapping of the local supply lines and pipes to identify blocks.",
                    "Deploy desilting machines and execute high-pressure line flushing to clear sewage/water blockage.",
                    "Approve budget for upgrading old drainage pipelines to high-density polyethylene (HDPE) conduits."
                ],
                "strategic_rationale": f"Address water issues in {ward} by clearing pipe blockages and expanding drainage capacity to prevent water stagnation."
            }
        elif "garbage" in category_lower or "waste" in category_lower:
            return {
                "primary_department": "BBMP Solid Waste Management Division",
                "estimated_budget_tier": "Low (under 10L INR)",
                "remediation_timeline": "Immediate (under 15 Days)",
                "action_steps": [
                    "Initiate double-shift garbage collection rounds in the micro-neighborhood hotspot.",
                    "Install local CCTV surveillance and post strict penalty notices for dumping in non-designated spots.",
                    "Conduct community awareness workshops on waste segregation at source to reduce black spots."
                ],
                "strategic_rationale": f"Resolve accumulation points in {ward} through immediate cleanups paired with strict surveillance to deter future dumping."
            }
        elif "road" in category_lower or "mobility" in category_lower or "pothole" in category_lower:
            return {
                "primary_department": "BBMP Engineering / PWD",
                "estimated_budget_tier": "High (above 50L INR)",
                "remediation_timeline": "Mid-term (1-3 Months)",
                "action_steps": [
                    "Fill dangerous potholes with hot-mix asphalt for immediate traffic safety.",
                    "Repave the broken road stretches using durable wet mix macadam sub-bases.",
                    "Reconstruct elevated pedestrian footpaths with tactile tiles for accessibility."
                ],
                "strategic_rationale": f"Reconstruct deteriorating roadways in {ward} to improve public safety and ease heavy commercial/commuter traffic."
            }
        elif "light" in category_lower or "electricity" in category_lower:
            return {
                "primary_department": "BESCOM (Bangalore Electricity Supply Company)",
                "estimated_budget_tier": "Low (under 10L INR)",
                "remediation_timeline": "Immediate (under 15 Days)",
                "action_steps": [
                    "Inspect and replace blown light bulbs and damaged street post wiring in the dark zones.",
                    "Install energy-efficient LED streetlamps equipped with automated light-sensitive timers.",
                    "Trim overhanging tree branches obscuring streetlights to maximize coverage area."
                ],
                "strategic_rationale": f"Restore public safety in dark spots of {ward} by instantly replacing damaged bulbs and optimizing lamp post coverage."
            }
        else:
            return {
                "primary_department": "Constituency Development Fund / Local Municipal Council",
                "estimated_budget_tier": "Medium (10L - 50L INR)",
                "remediation_timeline": "Mid-term (1-3 Months)",
                "action_steps": [
                    "Direct ward officers to conduct a physical survey of the citizen complaint hotspot.",
                    "Allocate ward-level development funds to resolve the immediate infrastructural bottleneck.",
                    "Establish a periodic review meeting with local resident welfare associations (RWAs)."
                ],
                "strategic_rationale": f"Deploy municipal officers to survey {ward} and outline custom repairs backed by community-level funds."
            }
