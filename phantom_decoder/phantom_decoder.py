import hashlib
import base64
from typing import Dict, List, Tuple
import secrets
import time

class PhantomEncoder:
    def __init__(self, salt_length: int = 16):
        self.salt_length = salt_length
        self.separator = "."
        self.encoding_map = self._create_encoding_map()
        
    def _create_encoding_map(self) -> Dict[str, str]:
        """Creates a bidirectional mapping for character encoding"""
        chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        shifted = chars[len(chars)//2:] + chars[:len(chars)//2]
        return {chars[i]: shifted[i] for i in range(len(chars))}
    
    def _generate_salt(self) -> str:
        """Generates a cryptographically secure random salt"""
        return secrets.token_hex(self.salt_length)
    
    def _apply_encoding_map(self, text: str, reverse: bool = False) -> str:
        """Applies the encoding map to the text"""
        if reverse:
            rev_map = {v: k for k, v in self.encoding_map.items()}
            return ''.join(rev_map.get(c, c) for c in text)
        return ''.join(self.encoding_map.get(c, c) for c in text)

    def encode_id(self, identity_data: Dict[str, str]) -> Tuple[str, str]:
        """
        Encodes identity data into a PhantomID
        Returns: (phantom_id, verification_key)
        """
        # Generate a random salt
        salt = self._generate_salt()
        
        # Create a sorted string of identity values
        identity_string = ''.join(str(v) for k, v in sorted(identity_data.items()))
        
        # Create the base hash with salt
        combined_string = f"{salt}{identity_string}"
        base_hash = hashlib.sha256(combined_string.encode()).hexdigest()
        
        # Create segments for the phantom ID
        timestamp = str(int(time.time()))
        version = "1"
        
        # Split the hash into two parts
        hash_part1 = base_hash[:32]
        hash_part2 = base_hash[32:]
        
        # Apply encoding to both parts
        encoded_hash1 = self._apply_encoding_map(hash_part1)
        encoded_hash2 = self._apply_encoding_map(hash_part2)
        
        # Combine all parts
        phantom_id = self.separator.join([version, encoded_hash1, salt])
        verification_key = self.separator.join([encoded_hash2, timestamp])
        
        return phantom_id, verification_key

    def verify_id(self, phantom_id: str, verification_key: str, identity_data: Dict[str, str]) -> bool:
        """
        Verifies if the provided identity data matches the PhantomID
        """
        try:
            # Split the phantom ID and verification key
            version, stored_hash_part1, salt = phantom_id.split(self.separator)
            stored_hash_part2, timestamp = verification_key.split(self.separator)
            
            # Decode both hash parts
            decoded_hash1 = self._apply_encoding_map(stored_hash_part1, reverse=True)
            decoded_hash2 = self._apply_encoding_map(stored_hash_part2, reverse=True)
            
            # Reconstruct the full hash
            stored_hash = decoded_hash1 + decoded_hash2
            
            # Create identity string
            identity_string = ''.join(str(v) for k, v in sorted(identity_data.items()))
            
            # Generate verification hash
            combined_string = f"{salt}{identity_string}"
            verify_hash = hashlib.sha256(combined_string.encode()).hexdigest()
            
            return verify_hash == stored_hash
            
        except Exception as e:
            print(f"Verification error: {e}")
            return False

    def generate_derived_id(self, phantom_id: str, purpose: str) -> str:
        """
        Generates a purpose-specific derived ID that can't be linked back
        to the original PhantomID but can still be verified
        """
        version, hash_part, salt = phantom_id.split(self.separator)
        
        # Create a new salt for the derived ID
        derived_salt = self._generate_salt()
        
        # Decode the original hash part
        decoded_hash = self._apply_encoding_map(hash_part, reverse=True)
        
        # Combine original hash with purpose and new salt
        derived_hash = hashlib.sha256(f"{decoded_hash}{purpose}{derived_salt}".encode()).hexdigest()
        encoded_derived = self._apply_encoding_map(derived_hash[:32])  # Only use first 32 chars
        
        return self.separator.join(["D1", encoded_derived, derived_salt])

# Example usage
def demo_phantom_encoder():
    # Create an instance of the encoder
    encoder = PhantomEncoder()
    
    # Sample identity data
    identity_data = {
        "name": "John Doe",
        "dob": "1990-01-01",
        "unique_number": "ABC123"
    }
    
    # Generate a PhantomID
    phantom_id, verification_key = encoder.encode_id(identity_data)
    print(f"Generated PhantomID: {phantom_id}")
    print(f"Verification Key: {verification_key}")
    
    # Verify the ID
    is_valid = encoder.verify_id(phantom_id, verification_key, identity_data)
    print(f"Verification result: {is_valid}")
    
    # Generate a derived ID for a specific purpose
    derived_id = encoder.generate_derived_id(phantom_id, "medical_records")
    print(f"Derived ID: {derived_id}")

if __name__ == "__main__":
    demo_phantom_encoder()