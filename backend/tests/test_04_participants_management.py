"""
Test Suite: Participants Management
Tests adding and removing participants from bills
"""
import pytest
import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or 'http://localhost:8001'
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')


class TestParticipantsManagement:
    """Participants management tests"""
    
    added_participant_id = None

    def test_add_participant_to_bill(self, api_client, auth_headers, test_bill_id):
        """Test POST /api/bills/{bill_id}/participants - Add new participant"""
        participant_payload = {
            "name": "TEST_Charlie",
            "contact_info": "charlie@test.com"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/bills/{test_bill_id}/participants",
            json=participant_payload,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Add participant failed with status {response.status_code}: {response.text}"
        
        data = response.json()
        assert "participants" in data, "participants field missing"
        
        # Find the newly added participant
        new_participant = next((p for p in data["participants"] if p["name"] == participant_payload["name"]), None)
        assert new_participant is not None, "Newly added participant not found"
        assert new_participant["contact_info"] == participant_payload["contact_info"], "Contact info mismatch"
        
        TestParticipantsManagement.added_participant_id = new_participant["participant_id"]
        print(f"✓ Add participant passed - Name: {new_participant['name']}, ID: {TestParticipantsManagement.added_participant_id}")
        
        # Verify splits were recalculated
        assert "splits" in data, "splits field missing"
        participant_split = next((s for s in data["splits"] if s["participant_id"] == TestParticipantsManagement.added_participant_id), None)
        assert participant_split is not None, "Split not created for new participant"
        print(f"✓ Split created for new participant: {participant_split['amount_due']}")

    def test_remove_participant_from_bill(self, api_client, auth_headers, test_bill_id):
        """Test DELETE /api/bills/{bill_id}/participants/{participant_id} - Remove participant"""
        if not TestParticipantsManagement.added_participant_id:
            pytest.skip("No participant added in previous test")
        
        response = api_client.delete(
            f"{BASE_URL}/api/bills/{test_bill_id}/participants/{TestParticipantsManagement.added_participant_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Remove participant failed with status {response.status_code}"
        
        data = response.json()
        participants = data.get("participants", [])
        
        # Verify participant is removed
        removed_participant = next((p for p in participants if p["participant_id"] == TestParticipantsManagement.added_participant_id), None)
        assert removed_participant is None, "Participant still present after removal"
        print(f"✓ Remove participant passed - Participant {TestParticipantsManagement.added_participant_id} removed")
        
        # Verify splits were recalculated
        splits = data.get("splits", [])
        participant_split = next((s for s in splits if s["participant_id"] == TestParticipantsManagement.added_participant_id), None)
        assert participant_split is None, "Split still exists for removed participant"
        print("✓ Split removed for participant")
