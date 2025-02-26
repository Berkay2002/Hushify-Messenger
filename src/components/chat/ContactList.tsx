import React, { useState } from 'react';
import Image from 'next/image';
import { Search, Plus } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import AddContactModal from './AddContactModal';

const ContactList: React.FC = () => {
  const { contacts, activeContact, setActiveContact, loadingContacts } = useChat();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Filter contacts based on search term
  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format last message time
  const formatTime = (date?: Date) => {
    if (!date) return '';

    const now = new Date();
    const messageDate = new Date(date);
    
    // If the message is from today, show time
    if (
      messageDate.getDate() === now.getDate() &&
      messageDate.getMonth() === now.getMonth() &&
      messageDate.getFullYear() === now.getFullYear()
    ) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If the message is from yesterday, show "Yesterday"
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (
      messageDate.getDate() === yesterday.getDate() &&
      messageDate.getMonth() === yesterday.getMonth() &&
      messageDate.getFullYear() === yesterday.getFullYear()
    ) {
      return 'Yesterday';
    }
    
    // Otherwise, show date
    return messageDate.toLocaleDateString([], { weekday: 'short' });
  };

  if (loadingContacts) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">Loading contacts...</div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col">
        {/* Header with search */}
        <div className="p-3 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder="Search messages"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-2 pl-10 pr-4 bg-gray-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
          </div>
        </div>

        {/* Add contact button */}
        <div className="p-2 border-b border-gray-200">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="w-full py-2 flex items-center justify-center gap-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Plus size={18} />
            <span>Add Contact</span>
          </button>
        </div>

        {/* Contacts list */}
        <div className="flex-1 overflow-y-auto">
          {filteredContacts.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchTerm ? 'No contacts match your search' : 'No contacts yet'}
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => setActiveContact(contact)}
                className={`p-3 flex items-center hover:bg-gray-100 cursor-pointer ${
                  activeContact?.id === contact.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="relative">
                  <Image
                    src={contact.avatar || '/api/placeholder/40/40'}
                    alt={contact.name}
                    width={40}
                    height={40}
                    className="h-12 w-12 rounded-full mr-3"
                  />
                  {contact.isOnline && (
                    <div className="absolute bottom-0 right-2 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-medium text-gray-900 truncate">{contact.name}</h3>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-1">
                      {formatTime(contact.lastMessageTimestamp)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-500 truncate">
                      {contact.lastMessage || 'No messages yet'}
                    </p>
                    {contact.unreadCount > 0 && (
                      <span className="bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center ml-1">
                        {contact.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add contact modal */}
      <AddContactModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </>
  );
};

export default ContactList;