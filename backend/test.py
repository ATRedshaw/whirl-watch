import requests
import json
from getpass import getpass

BASE_URL = 'http://localhost:5000/api'
token = None

def print_response(response):
    print(f"Status Code: {response.status_code}")
    print("Response:")
    print(json.dumps(response.json(), indent=2))
    print()

def register():
    print("\n=== Register ===")
    username = input("Username: ")
    email = input("Email: ")
    password = getpass("Password: ")
    
    response = requests.post(f"{BASE_URL}/register", json={
        'username': username,
        'email': email,
        'password': password
    })
    print_response(response)

def login():
    global token
    print("\n=== Login ===")
    username = input("Username: ")
    password = getpass("Password: ")
    
    response = requests.post(f"{BASE_URL}/login", json={
        'username': username,
        'password': password
    })
    print_response(response)
    if response.status_code == 200:
        token = response.json()['access_token']

def create_list():
    print("\n=== Create List ===")
    name = input("List name: ")
    description = input("Description: ")
    
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.post(f"{BASE_URL}/lists", headers=headers, json={
        'name': name,
        'description': description
    })
    print_response(response)

def get_lists():
    print("\n=== My Lists ===")
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.get(f"{BASE_URL}/lists", headers=headers)
    print_response(response)

def share_list():
    print("\n=== Share List ===")
    list_id = input("List ID: ")
    
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.post(f"{BASE_URL}/lists/{list_id}/share", headers=headers)
    print_response(response)

def join_list():
    print("\n=== Join List ===")
    share_code = input("Share code: ")
    
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.post(f"{BASE_URL}/lists/join/{share_code}", headers=headers)
    print_response(response)

def search_movies():
    print("\n=== Search Movies ===")
    query = input("Search query: ")
    
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.get(f"{BASE_URL}/movies/search", headers=headers, params={'query': query})
    print_response(response)

def get_movie_details():
    print("\n=== Get Movie Details ===")
    movie_id = input("Movie ID: ")
    
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.get(f"{BASE_URL}/movies/{movie_id}", headers=headers)
    print_response(response)

def add_movie_to_list():
    print("\n=== Add Movie to List ===")
    list_id = input("List ID: ")
    movie_id = input("Movie ID: ")
    
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.post(f"{BASE_URL}/lists/{list_id}/movies", headers=headers, json={
        'tmdb_id': movie_id
    })
    print_response(response)

def main_menu():
    while True:
        print("\n=== Movie Tracker CLI ===")
        print("1. Register")
        print("2. Login")
        print("3. Create List")
        print("4. View My Lists")
        print("5. Share List")
        print("6. Join List")
        print("7. Search Movies")
        print("8. Get Movie Details")
        print("9. Add Movie to List")
        print("0. Exit")
        
        choice = input("\nEnter choice (0-9): ")
        
        if choice == '0':
            break
        elif choice == '1':
            register()
        elif choice == '2':
            login()
        elif choice == '3':
            if not token:
                print("Please login first")
                continue
            create_list()
        elif choice == '4':
            if not token:
                print("Please login first")
                continue
            get_lists()
        elif choice == '5':
            if not token:
                print("Please login first")
                continue
            share_list()
        elif choice == '6':
            if not token:
                print("Please login first")
                continue
            join_list()
        elif choice == '7':
            if not token:
                print("Please login first")
                continue
            search_movies()
        elif choice == '8':
            if not token:
                print("Please login first")
                continue
            get_movie_details()
        elif choice == '9':
            if not token:
                print("Please login first")
                continue
            add_movie_to_list()
        else:
            print("Invalid choice")

if __name__ == '__main__':
    main_menu()
