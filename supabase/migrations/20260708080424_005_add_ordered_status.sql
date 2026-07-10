-- Dodaj status "Zamówione"
INSERT INTO statuses (name, description, color, sort_order, is_active)
VALUES ('Zamówione', 'Sprzęt zamówiony, oczekuje na dostawę', '#f97316', 1, true)
ON CONFLICT DO NOTHING;

-- Zmień sort_order dla innych statusów
UPDATE statuses SET sort_order = 2 WHERE name = 'Dostępny';
UPDATE statuses SET sort_order = 3 WHERE name = 'W użyciu';
UPDATE statuses SET sort_order = 4 WHERE name = 'W naprawie';
UPDATE statuses SET sort_order = 5 WHERE name = 'Wycofany';